
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

class MediaPipeService {
    private static instance: MediaPipeService;
    private landmarker: FaceLandmarker | null = null;
    private initializingPromise: Promise<FaceLandmarker> | null = null;

    private constructor() { }

    public static getInstance(): MediaPipeService {
        if (!MediaPipeService.instance) {
            MediaPipeService.instance = new MediaPipeService();
        }
        return MediaPipeService.instance;
    }

    public async preload(): Promise<void> {
        if (this.landmarker) return;
        if (this.initializingPromise) {
            await this.initializingPromise;
            return;
        }

        try {
            this.initializingPromise = new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error("MediaPipe initialization timeout after 10s"));
                }, 10000);

                (async () => {
                    try {
                    const MP_VERSION = "0.10.14"; // Matching package.json range
                    console.log(`Initializing MediaPipe Vision v${MP_VERSION}...`);
                    
                    const filesetResolver = await FilesetResolver.forVisionTasks(
                        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
                    );
                    
                    console.log("Fileset resolver loaded. Loading landmarker model...");
                    
                    const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                            delegate: "CPU"
                        },
                        outputFaceBlendshapes: true,
                        runningMode: "VIDEO",
                        numFaces: 5,
                        minFaceDetectionConfidence: 0.5,
                        minFacePresenceConfidence: 0.5,
                        minTrackingConfidence: 0.5
                    });
                    
                    clearTimeout(timeoutId);
                    this.landmarker = landmarker;
                    console.log("MediaPipe initialized successfully");
                    resolve(landmarker);
                } catch (e) {
                    clearTimeout(timeoutId);
                    reject(e);
                }
                })();
            });

            await this.initializingPromise;
        } catch (error) {
            console.error("Failed to preload MediaPipe:", error);
            this.initializingPromise = null;
            throw error;
        }
    }

    public async getLandmarker(): Promise<FaceLandmarker> {
        if (this.landmarker) return this.landmarker;

        // If already initializing, wait for it
        if (this.initializingPromise) {
            try {
                return await this.initializingPromise;
            } catch (e) {
                // If previous attempt failed, retry
                this.initializingPromise = null;
            }
        }

        await this.preload();
        if (this.landmarker) return this.landmarker;

        throw new Error("Failed to initialize FaceLandmarker");
    }
}

export const mediaPipeService = MediaPipeService.getInstance();
