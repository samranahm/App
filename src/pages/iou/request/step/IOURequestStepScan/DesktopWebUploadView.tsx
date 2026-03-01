import React, {useRef} from 'react';
import {PanResponder, View} from 'react-native';
import AttachmentPicker from '@components/AttachmentPicker';
import Button from '@components/Button';
import Icon from '@components/Icon';
import Text from '@components/Text';
import {useMemoizedLazyIllustrations} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import type {FileObject} from '@src/types/utils/Attachment';

type DesktopWebUploadViewProps = {
    PDFValidationComponent: React.ReactNode;
    shouldAcceptMultipleFiles: boolean;
    validateFiles: (files: FileObject[], items?: DataTransferItem[]) => void;
    setDesktopUploadViewHeight: (height: number) => void;
};

function DesktopWebUploadView({PDFValidationComponent, shouldAcceptMultipleFiles, validateFiles, setDesktopUploadViewHeight}: DesktopWebUploadViewProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const lazyIllustrations = useMemoizedLazyIllustrations(['ReceiptStack']);
    const panResponder = useRef(
        PanResponder.create({
            onPanResponderTerminationRequest: () => false,
        }),
    ).current;

    return (
        <View
            style={[styles.alignItemsCenter, styles.justifyContentCenter]}
            onLayout={(e) => {
                setDesktopUploadViewHeight(e.nativeEvent.layout.height);
            }}
        >
            {PDFValidationComponent}
            <Icon
                src={lazyIllustrations.ReceiptStack}
                width={CONST.RECEIPT.ICON_SIZE}
                height={CONST.RECEIPT.ICON_SIZE}
            />
            <View
                style={[styles.uploadFileViewTextContainer, styles.userSelectNone]}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...panResponder.panHandlers}
            >
                <Text style={[styles.textFileUpload, styles.mb2]}>{translate(shouldAcceptMultipleFiles ? 'receipt.uploadMultiple' : 'receipt.upload')}</Text>
                <Text style={[styles.textLabelSupporting, styles.textAlignCenter, styles.lineHeightLarge]}>
                    {translate(shouldAcceptMultipleFiles ? 'receipt.desktopSubtitleMultiple' : 'receipt.desktopSubtitleSingle')}
                </Text>
            </View>

            <AttachmentPicker allowMultiple={shouldAcceptMultipleFiles}>
                {({openPicker}) => (
                    <Button
                        success
                        text={translate(shouldAcceptMultipleFiles ? 'common.chooseFiles' : 'common.chooseFile')}
                        accessibilityLabel={translate(shouldAcceptMultipleFiles ? 'common.chooseFiles' : 'common.chooseFile')}
                        style={[styles.p5]}
                        onPress={() => {
                            openPicker({
                                onPicked: (data) => validateFiles(data),
                            });
                        }}
                        sentryLabel={CONST.SENTRY_LABEL.IOU_REQUEST_STEP.SCAN_SUBMIT_BUTTON}
                    />
                )}
            </AttachmentPicker>
        </View>
    );
}

export default DesktopWebUploadView;
export type {DesktopWebUploadViewProps};
