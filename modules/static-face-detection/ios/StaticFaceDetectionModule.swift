import ExpoModulesCore
import MLKitFaceDetection

struct DetectedFace: Record {
  @Field var bounds: BoundsRecord
  @Field var rollAngle: Double
  @Field var yawAngle: Double
  @Field var pitchAngle: Double
  @Field var landmarks: LandmarksRecord?
  @Field var smilingProbability: Double?
  @Field var leftEyeOpenProbability: Double?
  @Field var rightEyeOpenProbability: Double?
}

struct BoundsRecord: Record {
  @Field var x: Double
  @Field var y: Double
  @Field var width: Double
  @Field var height: Double
}

struct LandmarksRecord: Record {
  @Field var LEFT_EYE: PointRecord?
  @Field var RIGHT_EYE: PointRecord?
  @Field var NOSE_BASE: PointRecord?
  @Field var MOUTH_LEFT: PointRecord?
  @Field var MOUTH_RIGHT: PointRecord?
  @Field var MOUTH_BOTTOM: PointRecord?
  @Field var LEFT_CHEEK: PointRecord?
  @Field var RIGHT_CHEEK: PointRecord?
  @Field var LEFT_EAR: PointRecord?
  @Field var RIGHT_EAR: PointRecord?
}

struct PointRecord: Record {
  @Field var x: Double
  @Field var y: Double
}

struct DetectFacesResult: Record {
  @Field var faces: [DetectedFace]
  @Field var imageWidth: Double
  @Field var imageHeight: Double
}

public class StaticFaceDetectionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StaticFaceDetectionModule")

    AsyncFunction("detectFaces") { (imageUri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let url = URL(string: imageUri) ?? URL(fileURLWithPath: imageUri)
          let data = try Data(contentsOf: url)
          guard let image = UIImage(data: data) else {
            promise.reject("ERR_LOAD", "Cannot load image: \(imageUri)")
            return
          }

          let visionImage = VisionImage(image: image)
          let options = FaceDetectorOptions()
          options.performanceMode = .fast
          options.landmarkMode = .all
          options.classificationMode = .all
          options.minFaceSize = 0.15

          let detector = FaceDetector.faceDetector(options: options)
          detector.process(visionImage) { faces, error in
            if let error = error {
              promise.reject("ERR_DETECT", error.localizedDescription)
              return
            }

            let faceList = (faces ?? []).map { face -> DetectedFace in
              let bounds = BoundsRecord(
                x: Double(face.frame.origin.x),
                y: Double(face.frame.origin.y),
                width: Double(face.frame.width),
                height: Double(face.frame.height)
              )

              var landmarks = LandmarksRecord()
              if let lm = face.landmarks?[.leftEye] {
                landmarks.LEFT_EYE = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.rightEye] {
                landmarks.RIGHT_EYE = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.noseBase] {
                landmarks.NOSE_BASE = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.mouthLeft] {
                landmarks.MOUTH_LEFT = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.mouthRight] {
                landmarks.MOUTH_RIGHT = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.mouthBottom] {
                landmarks.MOUTH_BOTTOM = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.leftCheek] {
                landmarks.LEFT_CHEEK = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.rightCheek] {
                landmarks.RIGHT_CHEEK = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.leftEar] {
                landmarks.LEFT_EAR = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }
              if let lm = face.landmarks?[.rightEar] {
                landmarks.RIGHT_EAR = PointRecord(x: Double(lm.position.x), y: Double(lm.position.y))
              }

              return DetectedFace(
                bounds: bounds,
                rollAngle: Double(face.headEulerAngleZ),
                yawAngle: Double(face.headEulerAngleY),
                pitchAngle: Double(face.headEulerAngleX),
                landmarks: landmarks,
                smilingProbability: face.smilingProbability.map { Double($0) },
                leftEyeOpenProbability: face.leftEyeOpenProbability.map { Double($0) },
                rightEyeOpenProbability: face.rightEyeOpenProbability.map { Double($0) }
              )
            }

            let result = DetectFacesResult(
              faces: faceList,
              imageWidth: Double(image.size.width),
              imageHeight: Double(image.size.height)
            )
            promise.resolve(result.toDictionary())
          }
        } catch {
          promise.reject("ERR_LOAD", error.localizedDescription)
        }
      }
    }
  }
}
