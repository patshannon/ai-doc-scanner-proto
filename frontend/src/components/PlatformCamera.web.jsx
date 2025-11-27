import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';

export const PlatformCamera = forwardRef(({ style, facing = 'back', ...props }, ref) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  useImperativeHandle(ref, () => ({
    takePictureAsync: async (options) => {
      if (!videoRef.current) throw new Error('Camera not ready');
      
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Quality is 0-1
      const quality = options?.quality || 0.9;
      const uri = canvas.toDataURL('image/jpeg', quality);
      
      return {
        uri,
        width: canvas.width,
        height: canvas.height,
        exif: {} 
      };
    },
    getAvailablePictureSizesAsync: async () => [],
    recordAsync: async () => {},
    stopRecording: () => {},
    pausePreview: () => {},
    resumePreview: () => {},
  }));

  useEffect(() => {
    let mounted = true;
    let currentStream = null;

    const initCamera = async () => {
      // Define constraint sets to try, from highest quality to lowest
      const constraintSets = [
        // 4K / Ultra High Res
        {
          video: {
            facingMode: facing === 'front' ? 'user' : 'environment',
            width: { min: 1920, ideal: 3840 },
            height: { min: 1080, ideal: 2160 }
          },
          audio: false
        },
        // Full HD
        {
          video: {
            facingMode: facing === 'front' ? 'user' : 'environment',
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 }
          },
          audio: false
        },
        // HD
        {
          video: {
            facingMode: facing === 'front' ? 'user' : 'environment',
            width: { min: 640, ideal: 1280 },
            height: { min: 480, ideal: 720 }
          },
          audio: false
        },
        // Fallback (just ask for the camera)
        {
          video: {
            facingMode: facing === 'front' ? 'user' : 'environment'
          },
          audio: false
        }
      ];

      for (const constraints of constraintSets) {
        try {
          // console.log("[PlatformCamera] Requesting constraints:", JSON.stringify(constraints));
          
          const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          // If we got here, we successfully got a stream.
          currentStream = mediaStream;
          if (mounted) {
            setStream(mediaStream);
            if (videoRef.current) {
              videoRef.current.srcObject = mediaStream;
            }
          } else {
            mediaStream.getTracks().forEach(track => track.stop());
          }
          
          // Success, break the loop
          return; 
        } catch (err) {
          console.warn("[PlatformCamera] Failed to init with constraints:", JSON.stringify(constraints), err.name, err.message);
          // Continue to next constraint set
        }
      }
      
      console.error("[PlatformCamera] All constraint sets failed to initialize camera.");
    };

    initCamera();

    return () => {
      mounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facing]);

  return (
    <View style={[styles.container, style]}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'black',
  },
});
