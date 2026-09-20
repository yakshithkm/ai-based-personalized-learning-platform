// On-device face *presence* detection for the Exam Simulation.
//
// - Detection only: it answers "is there a face in this video frame?". There is no face
//   recognition, no identity, no landmarks and no face data is kept.
// - Runs entirely in the browser (TensorFlow.js via @vladmandic/face-api, tiny face detector).
//   Frames are never uploaded or stored, and no third-party service is called: the ~190 KB
//   model files are served from /models (see scripts/copy-face-models.mjs).
// - The library and model are loaded lazily, only once an exam is running with a live camera.

const MODEL_BASE = `${String(import.meta.env?.BASE_URL || '/').replace(/\/$/, '')}/models`;

let detectorPromise = null;

export const loadFaceDetector = () => {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE);
      // A slightly permissive threshold: the costly mistake here is wrongly reporting an
      // absent person, so borderline detections count as "present".
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });

      return {
        // Resolves true when at least one face is visible in the current frame.
        hasFace: async (video) => {
          const faces = await faceapi.detectAllFaces(video, options);
          return faces.length > 0;
        },
      };
    })().catch((error) => {
      detectorPromise = null; // allow a later retry
      throw error;
    });
  }
  return detectorPromise;
};

export default loadFaceDetector;