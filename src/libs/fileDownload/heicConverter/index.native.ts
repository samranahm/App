import {verifyFileFormat} from '@libs/fileDownload/FileUtils';
import fileURIToPath from '@libs/fileURIToPath';
import Log from '@libs/Log';

import CONST from '@src/CONST';
import type {FileObject} from '@src/types/utils/Attachment';

import {ImageManipulator, SaveFormat} from 'expo-image-manipulator';
import RNFetchBlob from 'react-native-blob-util';

import type {HeicConverterFunction} from './types';

/**
 * Helper function to convert HEIC/HEIF image to JPEG using ImageManipulator
 * @param file - The original file object
 * @param sourceUri - URI of the image to convert
 * @param originalExtension - The original file extension pattern to replace
 * @param callbacks - Callback functions for the conversion process
 */
const convertImageWithManipulator = (
    file: FileObject,
    sourceUri: string,
    originalExtension: RegExp,
    {
        onSuccess = () => {},
        onError = () => {},
        onFinish = () => {},
    }: {
        onSuccess?: (convertedFile: FileObject) => void;
        onError?: (error: unknown, originalFile: FileObject) => void;
        onFinish?: () => void;
    } = {},
) => {
    const imageManipulatorContext = ImageManipulator.manipulate(sourceUri);
    imageManipulatorContext
        .renderAsync()
        .then(async (manipulatedImage) => {
            try {
                const manipulationResult = await manipulatedImage.saveAsync({format: SaveFormat.JPEG});

                // ImageResult has no size; read the written JPEG so resize checks use real bytes.
                let size = file.size;
                try {
                    const jpegStat = await RNFetchBlob.fs.stat(fileURIToPath(manipulationResult.uri));
                    size = jpegStat.size;
                } catch (statError) {
                    Log.warn('Unable to read converted JPEG size, falling back to original file size', {
                        error: statError instanceof Error ? statError.message : String(statError),
                    });
                }

                const convertedFile = {
                    uri: manipulationResult.uri,
                    name: file.name?.replace(originalExtension, '.jpg') ?? 'converted-image.jpg',
                    type: 'image/jpeg',
                    size,
                    width: manipulationResult.width,
                    height: manipulationResult.height,
                };
                onSuccess(convertedFile);
            } finally {
                manipulatedImage.release();
            }
        })
        .catch((err) => {
            Log.warn('Error converting HEIC/HEIF to JPEG', {error: err instanceof Error ? err.message : String(err)});
            onError(err, file);
        })
        .finally(() => {
            imageManipulatorContext.release();
            onFinish();
        });
};

/**
 * Native implementation for converting HEIC/HEIF images to JPEG
 * @param file - The file to check and potentially convert
 * @param callbacks - Object containing callback functions for different stages of conversion
 */
const convertHeicImage: HeicConverterFunction = (file, {onSuccess = () => {}, onError = () => {}, onStart = () => {}, onFinish = () => {}} = {}) => {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const needsConversion = file.name?.toLowerCase().endsWith('.heic') || file.name?.toLowerCase().endsWith('.heif');

    if (!needsConversion || !file.uri || !file.type?.startsWith('image')) {
        onSuccess(file);
        return;
    }

    onStart();

    if (!file.uri) {
        onError(new Error('File URI is undefined'), file);
        onFinish();
        return;
    }

    // Conversion based on extension
    if (needsConversion) {
        const fileUri = file.uri;
        convertImageWithManipulator(file, fileUri, /\.(heic|heif)$/i, {
            onSuccess,
            onError,
            onFinish,
        });
        return;
    }

    // If not detected by extension, check using file signatures
    verifyFileFormat({fileUri: file.uri, formatSignatures: CONST.HEIC_SIGNATURES})
        .then((isHEIC) => {
            if (isHEIC) {
                const fileUri = file.uri;
                if (!fileUri) {
                    onError(new Error('File URI is undefined'), file);
                    onFinish();
                    return;
                }
                convertImageWithManipulator(file, fileUri, /\.heic$/i, {
                    onSuccess,
                    onError,
                    onFinish,
                });
                return;
            }

            onSuccess(file);
        })
        .catch((err) => {
            Log.warn('Error processing the file', {error: err instanceof Error ? err.message : String(err)});
            onError(err, file);
        })
        .finally(() => {
            onFinish();
        });
};

export default convertHeicImage;
