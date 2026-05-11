import React from 'react';
import { Image } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const svgPropsRef: {current: any} = {current: null};
const rectPropsList: any[] = [];

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: (props: any) => {
    svgPropsRef.current = props;
    const React = require('react');
    return React.createElement(React.Fragment, null, props.children);
  },
  Rect: (props: any) => {
    rectPropsList.push(props);
    return null;
  },
}));

import { CensoredImageView } from '../../src/components/CensoredImageView';

describe('CensoredImageView', () => {
  beforeEach(() => {
    svgPropsRef.current = null;
    rectPropsList.length = 0;
    jest.restoreAllMocks();
  });

  it('renders padded censorship boxes using censor dimensions', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, _success, _failure) => {
      _success?.(1000, 800);
    });

    await act(async () => {
      TestRenderer.create(
        <CensoredImageView
          uri="file:///tmp/image.jpg"
          resizeMode="cover"
          censor={{
            imageWidth: 1000,
            imageHeight: 800,
            boxes: [
              {x: 10, y: 20, width: 100, height: 50, category: 'keyword'},
              {x: 0, y: 1, width: 20, height: 20, category: 'email'},
            ],
          }}
        />,
      );
    });

    expect(svgPropsRef.current.viewBox).toBe('0 0 1000 800');
    expect(svgPropsRef.current.preserveAspectRatio).toBe('xMidYMid slice');
    expect(rectPropsList.length).toBeGreaterThanOrEqual(2);
    expect(rectPropsList.slice(-2)[0]).toEqual(expect.objectContaining({x: 5, y: 17, width: 110, height: 56}));
    expect(rectPropsList.slice(-2)[1]).toEqual(expect.objectContaining({x: 0, y: 0, width: 24, height: 24}));
  });

  it('falls back to Image.getSize when censor dimensions are missing', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => {
      success?.(640, 480);
    });

    await act(async () => {
      TestRenderer.create(
        <CensoredImageView
          uri="file:///tmp/image.jpg"
          censor={{
            imageWidth: 0,
            imageHeight: 0,
            boxes: [],
          }}
        />,
      );
    });

    expect(Image.getSize).toHaveBeenCalledWith('file:///tmp/image.jpg', expect.any(Function), expect.any(Function));
    expect(svgPropsRef.current).toBeNull();
  });

  it('clears fallback dimensions when Image.getSize fails', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((_uri, _success, failure) => {
      failure?.(new Error('size lookup failed'));
    });

    await act(async () => {
      TestRenderer.create(<CensoredImageView uri="file:///tmp/image.jpg" censor={null} />);
    });

    expect(svgPropsRef.current).toBeNull();
  });
});
