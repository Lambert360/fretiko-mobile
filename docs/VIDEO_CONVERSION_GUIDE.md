# Video Conversion Guide for React Native Compatibility

## Problem
The app is experiencing video playback errors due to HEVC (H.265) codec incompatibility on Android devices.

## Error Message
```
MediaCodecVideoRenderer error, index=0, format=Format(1, null, video/mp4, video/hevc, hvc1.1.6.L150.B0, ...)
Decoder init failed: OMX.MTK.VIDEO.DECODER.HEVC
format_supported=NO_EXCEEDS_CAPABILITIES
```

## Solution

### 1. Convert Existing Videos

Use FFmpeg to convert HEVC videos to H.264:

```bash
# Basic conversion
ffmpeg -i input_hevc.mp4 -c:v libx264 -preset medium -crf 23 output_h264.mp4

# High compatibility conversion (recommended)
ffmpeg -i input_hevc.mp4 \
       -c:v libx264 \
       -preset medium \
       -crf 23 \
       -maxrate 5M \
       -bufsize 10M \
       -pix_fmt yuv420p \
       -c:a aac \
       -b:a 128k \
       output_compatible.mp4

# Batch conversion script
for file in *.mp4; do
    if ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$file" | grep -q "hevc"; then
        echo "Converting $file from HEVC to H.264..."
        ffmpeg -i "$file" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -c:a aac "${file%.mp4}_converted.mp4"
    fi
done
```

### 2. Update Upload Requirements

Modify your upload service to only accept H.264 videos:

```javascript
// Example validation function
function validateVideoFormat(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      // Check if video is H.264
      video.currentTime = 0.1;
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        // Additional validation logic here
        resolve(true);
      };
    };
    video.onerror = () => resolve(false);
    video.src = URL.createObjectURL(file);
  });
}
```

### 3. Server-side Processing

Add server-side video conversion:

```javascript
// Example using fluent-ffmpeg
const ffmpeg = require('fluent-ffmpeg');

function convertVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .outputOptions([
        '-preset medium',
        '-crf 23',
        '-maxrate 5M',
        '-bufsize 10M',
        '-pix_fmt yuv420p'
      ])
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}
```

## Recommended Video Specifications

### For Android Compatibility
- **Codec**: H.264 (AVC)
- **Container**: MP4
- **Resolution**: Maximum 1920x1080 (Full HD)
- **Bitrate**: Maximum 5 Mbps
- **Audio**: AAC, 128 kbps
- **Frame Rate**: 30 fps or less

### For iOS Compatibility
- **Codec**: H.264 (AVC)
- **Container**: MP4
- **Resolution**: Maximum 3840x2160 (4K)
- **Bitrate**: Maximum 10 Mbps
- **Audio**: AAC, 128 kbps
- **Frame Rate**: 60 fps or less

## Testing

After conversion, test videos on:
1. Low-end Android devices
2. Mid-range Android devices
3. High-end Android devices
4. iOS devices

## Prevention

To prevent this issue in the future:

1. **Client-side validation**: Check video format before upload
2. **Server-side conversion**: Automatically convert incompatible videos
3. **User feedback**: Inform users when video conversion is needed
4. **Fallback options**: Provide alternative content when video fails to play

## Tools

- **FFmpeg**: Video conversion
- **HandBrake**: GUI alternative to FFmpeg
- **MediaInfo**: Analyze video codecs and formats
- **VLC**: Test video playback compatibility
