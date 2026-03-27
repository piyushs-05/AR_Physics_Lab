/**
 * Compile a target image into a .mind file for MindAR.
 * Bypasses the native 'canvas' dependency by using 'sharp' for image loading.
 */
import sharp from 'sharp';
import { writeFileSync } from 'fs';

// Patch: provide a fake createCanvas before importing MindAR compiler
import Module from 'module';
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  if (request === 'canvas') {
    // Return a shim that provides createCanvas
    return request;
  }
  return origResolve.call(this, request, parent, ...args);
};

// Register a canvas shim
import { register } from 'module';

// We'll manually construct the target data instead of using OfflineCompiler
const { buildImageList, buildTrackingImageList } = await import(
  './node_modules/mind-ar/src/image-target/image-list.js'
);
const { extractTrackingFeatures } = await import(
  './node_modules/mind-ar/src/image-target/tracker/extract-utils.js'
);
const { build: hierarchicalClusteringBuild } = await import(
  './node_modules/mind-ar/src/image-target/matching/hierarchical-clustering.js'
);
const { Detector } = await import(
  './node_modules/mind-ar/src/image-target/detector/detector.js'
);

// Import detector CPU kernels
await import('./node_modules/mind-ar/src/image-target/detector/kernels/cpu/index.js');

const msgpack = await import('@msgpack/msgpack');
const tf = await import('@tensorflow/tfjs');

const CURRENT_VERSION = 2;

async function compileImage(imagePath) {
  console.log('Loading image...');
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  console.log(`Image: ${width}x${height}`);

  // Convert RGBA to greyscale
  const greyImageData = new Uint8Array(width * height);
  for (let i = 0; i < greyImageData.length; i++) {
    const offset = i * 4;
    greyImageData[i] = Math.floor(
      (data[offset] + data[offset + 1] + data[offset + 2]) / 3
    );
  }

  const targetImage = { data: greyImageData, height, width };

  // Build image list for matching
  console.log('Building image list...');
  const imageList = buildImageList(targetImage);

  // Extract matching features
  console.log('Extracting matching features...');
  const keyframes = [];
  for (let i = 0; i < imageList.length; i++) {
    const image = imageList[i];
    const detector = new Detector(image.width, image.height);
    await tf.nextFrame();
    tf.tidy(() => {
      const inputT = tf
        .tensor(image.data, [image.data.length], 'float32')
        .reshape([image.height, image.width]);
      const { featurePoints: ps } = detector.detect(inputT);
      const maximaPoints = ps.filter((p) => p.maxima);
      const minimaPoints = ps.filter((p) => !p.maxima);
      const maximaPointsCluster = hierarchicalClusteringBuild({ points: maximaPoints });
      const minimaPointsCluster = hierarchicalClusteringBuild({ points: minimaPoints });
      keyframes.push({
        maximaPoints,
        minimaPoints,
        maximaPointsCluster,
        minimaPointsCluster,
        width: image.width,
        height: image.height,
        scale: image.scale,
      });
    });
    console.log(`  Matching feature ${i + 1}/${imageList.length}`);
  }

  // Build tracking image list and extract tracking features
  console.log('Extracting tracking features...');
  const trackingImageList = buildTrackingImageList(targetImage);
  const trackingData = extractTrackingFeatures(trackingImageList, (index) => {
    console.log(`  Tracking feature ${index + 1}/${trackingImageList.length}`);
  });

  // Pack data
  console.log('Packing .mind file...');
  const dataList = [
    {
      targetImage: { width, height },
      trackingData,
      matchingData: keyframes,
    },
  ];
  const buffer = msgpack.encode({ v: CURRENT_VERSION, dataList });

  const outputPath = './vendor/target.mind';
  writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`Done! Written to ${outputPath} (${buffer.byteLength} bytes)`);
}

await compileImage('./download (1).jpg');
process.exit(0);
