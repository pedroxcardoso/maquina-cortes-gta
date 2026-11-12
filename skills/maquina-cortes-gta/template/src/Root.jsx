import React from 'react';
import {Composition} from 'remotion';
import {SplitCut} from './SplitCut.jsx';

export const FPS = 30;

// Valores de exemplo (o build.mjs sobrescreve tudo com --props).
const defaultProps = {
  totalSeconds: 5,
  segments: [{from: 0, to: 5}],
  sourceFile: 'source.mp4',
  bottomFile: 'bottom.mp4',
  bottomStart: 0,
  bottomDuration: 0,
  focus: {x: 50, y: 35},
  crop: null,
  sourceWidth: 1280,
  sourceHeight: 720,
  pages: [],
  watermark: {logo: 'logo.png', name: 'SEU PERFIL'},
};

export const Root = () => (
  <Composition
    id="SplitCut"
    component={SplitCut}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={FPS * 5}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({
      durationInFrames: Math.max(1, Math.round(props.totalSeconds * FPS)),
      fps: FPS,
    })}
  />
);
