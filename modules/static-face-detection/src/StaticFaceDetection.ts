import { requireNativeModule } from 'expo-modules-core';

export type DetectedFace = {
  bounds: { x: number; y: number; width: number; height: number };
  rollAngle: number;
  yawAngle: number;
  pitchAngle: number;
  landmarks: {
    LEFT_EYE?: { x: number; y: number };
    RIGHT_EYE?: { x: number; y: number };
    NOSE_BASE?: { x: number; y: number };
    MOUTH_LEFT?: { x: number; y: number };
    MOUTH_RIGHT?: { x: number; y: number };
    MOUTH_BOTTOM?: { x: number; y: number };
    LEFT_CHEEK?: { x: number; y: number };
    RIGHT_CHEEK?: { x: number; y: number };
    LEFT_EAR?: { x: number; y: number };
    RIGHT_EAR?: { x: number; y: number };
  } | null;
  smilingProbability: number | null;
  leftEyeOpenProbability: number | null;
  rightEyeOpenProbability: number | null;
};

export type DetectFacesResult = {
  faces: DetectedFace[];
  imageWidth: number;
  imageHeight: number;
};

const StaticFaceDetectionModule = requireNativeModule('StaticFaceDetectionModule');

export function detectFaces(imageUri: string): Promise<DetectFacesResult> {
  return StaticFaceDetectionModule.detectFaces(imageUri);
}

export default { detectFaces };
