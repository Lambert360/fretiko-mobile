#!/bin/bash

# Video conversion script for React Native compatibility
# Converts HEVC videos to H.264 which is universally supported

echo "Converting videos to H.264 format for React Native compatibility..."

# Find all MP4 files in the media directory
find /path/to/media -name "*.mp4" -type f | while read video; do
    echo "Processing: $video"
    
    # Get video info to check if it's HEVC
    codec=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "$video")
    
    if [ "$codec" = "hevc" ]; then
        echo "Converting HEVC to H.264: $video"
        
        # Create backup
        cp "$video" "$video.backup"
        
        # Convert to H.264 with compatible settings
        ffmpeg -i "$video" \
               -c:v libx264 \
               -preset medium \
               -crf 23 \
               -maxrate 5M \
               -bufsize 10M \
               -pix_fmt yuv420p \
               -c:a aac \
               -b:a 128k \
               "${video%.mp4}_converted.mp4"
        
        echo "Conversion complete: ${video%.mp4}_converted.mp4"
    else
        echo "Video is already H.264 or compatible: $video"
    fi
done

echo "All videos processed!"
