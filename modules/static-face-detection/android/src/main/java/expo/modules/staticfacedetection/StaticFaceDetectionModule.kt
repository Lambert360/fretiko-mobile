package expo.modules.staticfacedetection

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.io.InputStream

class StaticFaceDetectionModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exception("No Android context")

  // Most photos store orientation in EXIF instead of baking it into pixels.
  // decodeStream ignores EXIF, so faces in rotated photos would be missed or
  // mispositioned — rotate the bitmap to display orientation before detection.
  private fun applyExifOrientation(uri: Uri, bitmap: Bitmap): Bitmap {
    var exifStream: InputStream? = null
    return try {
      exifStream = context.contentResolver.openInputStream(uri)
      if (exifStream == null) return bitmap
      val exif = ExifInterface(exifStream)
      val matrix = Matrix()
      when (exif.getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL
      )) {
        ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
        ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
        ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> {
          matrix.postScale(-1f, 1f); matrix.postRotate(270f)
        }
        ExifInterface.ORIENTATION_TRANSVERSE -> {
          matrix.postScale(-1f, 1f); matrix.postRotate(90f)
        }
        else -> return bitmap
      }
      Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    } catch (e: Exception) {
      bitmap
    } finally {
      try { exifStream?.close() } catch (_: Exception) {}
    }
  }

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
        val rawBitmap: Bitmap? = BitmapFactory.decodeStream(inputStream)
        inputStream.close()
        if (rawBitmap == null) {
          promise.reject("ERR_DECODE", "Cannot decode image: $imageUri", null)
          return@AsyncFunction
        }
        val bitmap = applyExifOrientation(uri, rawBitmap)

        val image = InputImage.fromBitmap(bitmap, 0)
        val options = FaceDetectorOptions.Builder()
          .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
          .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
          .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
          .setMinFaceSize(0.1f)
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
            if (bitmap !== rawBitmap) rawBitmap.recycle()
            promise.resolve(result)
          }
          .addOnFailureListener { e ->
            bitmap.recycle()
            if (bitmap !== rawBitmap) rawBitmap.recycle()
            promise.reject("ERR_DETECT", e.message, e)
          }
      } catch (e: Exception) {
        promise.reject("ERR_EXCEPTION", e.message, e)
      }
    }
  }
}
