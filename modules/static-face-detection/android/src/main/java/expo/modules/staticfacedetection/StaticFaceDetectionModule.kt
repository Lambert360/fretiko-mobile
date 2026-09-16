package expo.modules.staticfacedetection

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class StaticFaceDetectionModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exception("No Android context")

  override fun definition() = ModuleDefinition {
    Name("StaticFaceDetectionModule")

    AsyncFunction("detectFaces") { imageUri: String, promise: Promise ->
      try {
        val uri = Uri.parse(imageUri)
        val inputStream = context.contentResolver.openInputStream(uri)
        if (inputStream == null) {
          promise.reject("ERR_OPEN", "Cannot open image: $imageUri", null)
          return@AsyncFunction
        }
        val bitmap: Bitmap = BitmapFactory.decodeStream(inputStream)
        if (bitmap == null) {
          inputStream.close()
          promise.reject("ERR_DECODE", "Cannot decode image: $imageUri", null)
          return@AsyncFunction
        }
        inputStream.close()

        val image = InputImage.fromBitmap(bitmap, 0)
        val options = FaceDetectorOptions.Builder()
          .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
          .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
          .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
          .setMinFaceSize(0.15f)
          .build()

        val detector = FaceDetection.getClient(options)
        detector.process(image)
          .addOnSuccessListener { faces ->
            val faceList = faces.map { face ->
              val bounds = mapOf(
                "x" to face.boundingBox.left.toDouble(),
                "y" to face.boundingBox.top.toDouble(),
                "width" to face.boundingBox.width().toDouble(),
                "height" to face.boundingBox.height().toDouble()
              )
              val landmarks = mutableMapOf<String, Map<String, Double>>()
              val landmarkTypes = listOf(
                FaceLandmark.LEFT_EYE to "LEFT_EYE",
                FaceLandmark.RIGHT_EYE to "RIGHT_EYE",
                FaceLandmark.NOSE_BASE to "NOSE_BASE",
                FaceLandmark.MOUTH_LEFT to "MOUTH_LEFT",
                FaceLandmark.MOUTH_RIGHT to "MOUTH_RIGHT",
                FaceLandmark.MOUTH_BOTTOM to "MOUTH_BOTTOM",
                FaceLandmark.LEFT_CHEEK to "LEFT_CHEEK",
                FaceLandmark.RIGHT_CHEEK to "RIGHT_CHEEK",
                FaceLandmark.LEFT_EAR to "LEFT_EAR",
                FaceLandmark.RIGHT_EAR to "RIGHT_EAR"
              )
              for ((type, name) in landmarkTypes) {
                val lm = face.getLandmark(type)
                if (lm != null) {
                  landmarks[name] = mapOf(
                    "x" to lm.position.x.toDouble(),
                    "y" to lm.position.y.toDouble()
                  )
                }
              }
              mapOf(
                "bounds" to bounds,
                "rollAngle" to face.headEulerAngleZ.toDouble(),
                "yawAngle" to face.headEulerAngleY.toDouble(),
                "pitchAngle" to face.headEulerAngleX.toDouble(),
                "landmarks" to landmarks.ifEmpty { null },
                "smilingProbability" to face.smilingProbability?.toDouble(),
                "leftEyeOpenProbability" to face.leftEyeOpenProbability?.toDouble(),
                "rightEyeOpenProbability" to face.rightEyeOpenProbability?.toDouble()
              )
            }
            val result = mapOf(
              "faces" to faceList,
              "imageWidth" to bitmap.width.toDouble(),
              "imageHeight" to bitmap.height.toDouble()
            )
            bitmap.recycle()
            promise.resolve(result)
          }
          .addOnFailureListener { e ->
            bitmap.recycle()
            promise.reject("ERR_DETECT", e.message, e)
          }
      } catch (e: Exception) {
        promise.reject("ERR_EXCEPTION", e.message, e)
      }
    }
  }
}
