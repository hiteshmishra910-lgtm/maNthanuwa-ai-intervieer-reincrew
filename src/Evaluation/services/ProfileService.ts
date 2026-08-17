import { EvaluationProfile, EVALUATION_PROFILES_REGISTRY } from '../pipeline/interfaces';
import { supabase } from '../../Core/database/supabaseClient'; // assuming standard path
import { QuestionType } from '../../../types';

interface CacheEntry {
  profile: EvaluationProfile;
  cachedAt: number;
}

export class ProfileService {
  private static instance: ProfileService;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  /**
   * Invalidates a specific profile ID from the cache.
   * Exposes an endpoint for Admin Dashboard immediately clear cache.
   */
  public invalidate(profileId: string): void {
    this.cache.delete(profileId);
  }

  /**
   * Flushes the entire cache.
   */
  public invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Resolves the profile. Tries to fetch from DB and caches it.
   * If DB is unreachable, falls back to the hardcoded registry to ensure
   * interviews never crash.
   */
  public async getActiveProfile(profileId: string, questionType: QuestionType): Promise<EvaluationProfile> {
    // 1. Check Cache
    const entry = this.cache.get(profileId);
    if (entry && (Date.now() - entry.cachedAt) < this.CACHE_TTL_MS) {
      return entry.profile;
    }

    try {
      // 2. Fetch from DB
      // We first need the active version number from the profile, then fetch that specific version.
      const { data: profileData, error: profileError } = await supabase
        .from('evaluation_profiles')
        .select('current_version')
        .eq('id', profileId)
        .single();

      if (profileError || !profileData) {
        throw new Error(`Profile not found: ${profileError?.message}`);
      }

      const { data: versionData, error: versionError } = await supabase
        .from('evaluation_profile_versions')
        .select('id, version_number, weights, required_dimensions')
        .eq('profile_id', profileId)
        .eq('version_number', profileData.current_version)
        .single();

      if (versionError || !versionData) {
        throw new Error(`Profile version not found: ${versionError?.message}`);
      }

      // Map to interface
      const profile: EvaluationProfile = {
        id: versionData.id,
        version_number: versionData.version_number,
        accuracyWeight: versionData.weights.accuracyWeight ?? 0,
        understandingWeight: versionData.weights.understandingWeight ?? 0,
        reasoningWeight: versionData.weights.reasoningWeight ?? 0,
        communicationWeight: versionData.weights.communicationWeight ?? 0,
        confidenceWeight: versionData.weights.confidenceWeight ?? 0,
        requiredDimensions: versionData.required_dimensions as any,
      };

      // 3. Cache and return
      this.cache.set(profileId, { profile, cachedAt: Date.now() });
      return profile;

    } catch (e) {
      console.warn(`[ProfileService] Failed to load profile ${profileId} from DB. Using fallback registry.`, e);
      // 4. Fallback to Registry
      const fallback = EVALUATION_PROFILES_REGISTRY[questionType];
      if (!fallback) {
        // Ultimate fallback
        return EVALUATION_PROFILES_REGISTRY['Technical'];
      }
      return fallback;
    }
  }
}

export const profileService = ProfileService.getInstance();
