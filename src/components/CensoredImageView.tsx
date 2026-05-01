/**
 * components/CensoredImageView.tsx
 *
 * Renders a document image with opaque black rectangles drawn over detected
 * sensitive regions. The SVG overlay is scaled to match the image using
 * viewBox + preserveAspectRatio so boxes stay pixel-correct at every zoom
 * level and for every Image resizeMode.
 *
 * Use forwardRef + collapsable={false} on the wrapper so callers that use
 * react-native-view-shot (or similar) get the full composited view.
 */

import React, { forwardRef, useEffect, useState } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { CensorResult } from '../services/censor/censorImage';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type CensoredImageViewProps = {
  uri: string;
  censor: CensorResult | null;
  resizeMode?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CensoredImageView = forwardRef<View, CensoredImageViewProps>(
  ({ uri, censor, resizeMode = 'contain', style }, ref) => {
    // Fallback image dimensions obtained via Image.getSize when censor hasn't
    // provided them (e.g. while scanning or when OCR module is absent).
    const [fallbackDims, setFallbackDims] = useState<{
      width: number;
      height: number;
    } | null>(null);

    useEffect(() => {
      if (!uri) {
        return;
      }
      Image.getSize(
        uri,
        (w, h) => setFallbackDims({ width: w, height: h }),
        () => setFallbackDims(null),
      );
    }, [uri]);

    // Prefer dimensions from the censor result (true pixel dims from header
    // parsing) and fall back to Image.getSize.
    const vw =
      (censor?.imageWidth && censor.imageWidth > 0
        ? censor.imageWidth
        : fallbackDims?.width) ?? 0;
    const vh =
      (censor?.imageHeight && censor.imageHeight > 0
        ? censor.imageHeight
        : fallbackDims?.height) ?? 0;

    const hasDims = vw > 0 && vh > 0;
    const hasBoxes = (censor?.boxes?.length ?? 0) > 0;

    // SVG preserveAspectRatio must mirror the Image resizeMode exactly
    const preserveAspectRatio =
      resizeMode === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[StyleSheet.absoluteFill, style]}
      >
        <Image
          source={{ uri }}
          resizeMode={resizeMode}
          style={StyleSheet.absoluteFill}
        />

        {hasDims && hasBoxes ? (
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox={`0 0 ${vw} ${vh}`}
            preserveAspectRatio={preserveAspectRatio}
          >
            {censor!.boxes.map((box, index) => {
              // 5% padding, minimum 2px on each side
              const padV = Math.max(2, Math.round(box.height * 0.05));
              const padH = Math.max(2, Math.round(box.width * 0.05));
              const x = Math.max(0, box.x - padH);
              const y = Math.max(0, box.y - padV);
              const width = box.width + padH * 2;
              const height = box.height + padV * 2;

              return (
                <Rect
                  key={`${index}-${box.category}`}
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill="#000000"
                  rx={2}
                  ry={2}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
    );
  },
);

CensoredImageView.displayName = 'CensoredImageView';

