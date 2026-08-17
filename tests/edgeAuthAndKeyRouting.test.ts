import { describe, it, expect } from 'vitest';
import { classifyApiKey } from '../src/Core/ai/openRouterClient';
import { getEdgeFunctionAuthHeaders, buildEdgeFunctionRequest, setClerkToken, clearAuthTokens } from '../src/Core/database/supabaseClient';

describe('Edge Auth & Resilient Key Routing Suite', () => {

  describe('API Key Classifier (classifyApiKey)', () => {
    it('should correctly classify Google AQ.* API key format', () => {
      const result = classifyApiKey('AQ.mock_dummy_google_test_key');
      expect(result).toEqual({
        provider: 'google',
        format: 'google-studio-aq',
        valid: true
      });
    });

    it('should correctly classify Google AIzaSy* API key format', () => {
      const result = classifyApiKey('AIzaSyD-TestKey1234567890');
      expect(result).toEqual({
        provider: 'google',
        format: 'google-studio-aiza',
        valid: true
      });
    });

    it('should correctly classify OpenRouter sk-or-v1-* API key format', () => {
      const result = classifyApiKey('sk-or-v1-mock_dummy_openrouter_test_key');
      expect(result).toEqual({
        provider: 'openrouter',
        format: 'openrouter-v1',
        valid: true
      });
    });

    it('should correctly classify OpenRouter generic sk-* API key format', () => {
      const result = classifyApiKey('sk-generic1234567890');
      expect(result).toEqual({
        provider: 'openrouter',
        format: 'openrouter-generic',
        valid: true
      });
    });

    it('should reject invalid, null, or empty API keys', () => {
      expect(classifyApiKey('')).toEqual({ provider: 'unknown', format: 'unknown', valid: false });
      expect(classifyApiKey(undefined)).toEqual({ provider: 'unknown', format: 'unknown', valid: false });
      expect(classifyApiKey('   ')).toEqual({ provider: 'unknown', format: 'unknown', valid: false });
      expect(classifyApiKey('invalid-prefix-123')).toEqual({ provider: 'unknown', format: 'unknown', valid: false });
    });
  });

  describe('Centralized Edge Function Auth Headers (getEdgeFunctionAuthHeaders)', () => {
    it('should include apikey and Authorization Bearer header for Supabase Gateway', () => {
      clearAuthTokens();
      const headers = getEdgeFunctionAuthHeaders();
      expect(headers).toHaveProperty('apikey');
      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toMatch(/^Bearer /);
    });

    it('should attach X-Clerk-Token when Clerk JWT is set', () => {
      clearAuthTokens();
      const testToken = 'eyJhbGciOiJSUzI1NiIs...testClerkJwt';
      setClerkToken(testToken);

      const headers = getEdgeFunctionAuthHeaders();
      expect(headers).toHaveProperty('X-Clerk-Token', testToken);
      expect(headers.Authorization).toMatch(/^Bearer /); // Gateway token preserved
    });

    it('should allow overriding token explicitly in helper', () => {
      clearAuthTokens();
      const overrideToken = 'eyJhbGciOiJSUzI1NiIs...overrideJwt';
      const headers = getEdgeFunctionAuthHeaders(overrideToken);
      expect(headers).toHaveProperty('X-Clerk-Token', overrideToken);
    });
  });

  describe('Centralized Request Builder (buildEdgeFunctionRequest)', () => {
    it('should construct a POST request with JSON stringified body and correct auth headers', () => {
      clearAuthTokens();
      const bodyPayload = { sessionId: 'sess-123', prompt: 'test' };
      const reqInit = buildEdgeFunctionRequest(bodyPayload);

      expect(reqInit.method).toBe('POST');
      expect(reqInit.body).toBe(JSON.stringify(bodyPayload));
      expect(reqInit.headers).toHaveProperty('Content-Type', 'application/json');
      expect(reqInit.headers).toHaveProperty('apikey');
      expect(reqInit.headers).toHaveProperty('Authorization');
    });
  });

});
