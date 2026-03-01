import React, {useCallback, useEffect, useState} from 'react';
import {View} from 'react-native';
import {RESULTS} from 'react-native-permissions';
import DragAndDropConsumer from '@components/DragAndDrop/Consumer';
import {useDragAndDropState} from '@components/DragAndDrop/Provider';
import DropZoneUI from '@components/DropZone/DropZoneUI';
import LocationPermissionModal from '@components/LocationPermissionModal';
import ReceiptAlternativeMethods from '@components/ReceiptAlternativeMethods';
import withCurrentUserPersonalDetails from '@components/withCurrentUserPersonalDetails';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {clearUserLocation, setUserLocation} from '@libs/actions/UserLocation';
import {isMobile} from '@libs/Browser';
import {isLocalFile as isLocalFileFileUtils} from '@libs/fileDownload/FileUtils';
import getCurrentPosition from '@libs/getCurrentPosition';
import Navigation from '@libs/Navigation/Navigation';
import {endSpan} from '@libs/telemetry/activeSpans';
import StepScreenDragAndDropWrapper from '@pages/iou/request/step/StepScreenDragAndDropWrapper';
import withFullTransactionOrNotFound from '@pages/iou/request/step/withFullTransactionOrNotFound';
import withWritableReportOrNotFound from '@pages/iou/request/step/withWritableReportOrNotFound';
import {checkIfScanFileCanBeRead, replaceReceipt, setMoneyRequestReceipt, updateLastLocationPermissionPrompt} from '@userActions/IOU';
import {buildOptimisticTransactionAndCreateDraft, removeDraftTransactions, removeTransactionReceipt} from '@userActions/TransactionEdit';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {FileObject} from '@src/types/utils/Attachment';
import DesktopWebUploadView from './DesktopWebUploadView';
import {getLocationPermission} from './LocationPermission';
import MobileWebCameraView from './MobileWebCameraView';
import type IOURequestStepScanProps from './types';
import useReceiptScan from './useReceiptScan';

function IOURequestStepScan({
    report,
    route: {
        params: {action, iouType, reportID, transactionID: initialTransactionID, backTo, backToReport},
    },
    transaction: initialTransaction,
    currentUserPersonalDetails,
    onLayout,
    isMultiScanEnabled = false,
    isStartingScan = false,
    setIsMultiScanEnabled,
}: Omit<IOURequestStepScanProps, 'user'>) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const isMobileWeb = isMobile();
    const canUseDragAndDrop = !isMobileWeb;
    const {translate} = useLocalize();
    const {isDraggingOver} = useDragAndDropState();
    const policy = usePolicy(report?.policyID);
    const lazyIcons = useMemoizedLazyExpensifyIcons(['ReplaceReceipt', 'SmartScan']);
    const [policyCategories] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${report?.policyID}`);

    // End the create expense span on mount for web (no camera init tracking needed)
    useEffect(() => {
        endSpan(CONST.TELEMETRY.SPAN_OPEN_CREATE_EXPENSE);
    }, []);

    const navigateBack = useCallback(() => {
        Navigation.goBack(backTo);
    }, [backTo]);

    const updateScanAndNavigate = useCallback(
        (file: FileObject, source: string) => {
            replaceReceipt({transactionID: initialTransactionID, file: file as File, source, transactionPolicy: policy, transactionPolicyCategories: policyCategories});
            navigateBack();
        },
        [initialTransactionID, navigateBack, policy, policyCategories],
    );

    const getSource = useCallback((file: FileObject) => file.uri ?? URL.createObjectURL(file as Blob), []);

    // Shared business logic from useReceiptScan hook
    const {
        transactions,
        isEditing,
        canUseMultiScan,
        isReplacingReceipt,
        shouldAcceptMultipleFiles,
        startLocationPermissionFlow,
        setStartLocationPermissionFlow,
        receiptFiles,
        setReceiptFiles,
        shouldShowMultiScanEducationalPopup,
        navigateToConfirmationStep,
        validateFiles,
        PDFValidationComponent,
        ErrorModal,
        submitReceipts,
        submitMultiScanReceipts,
        toggleMultiScan,
        dismissMultiScanEducationalPopup,
        blinkStyle,
        showBlink,
        setTestReceiptAndNavigate,
    } = useReceiptScan({
        report,
        reportID,
        initialTransactionID,
        initialTransaction,
        iouType,
        action,
        currentUserPersonalDetails,
        backTo,
        backToReport,
        isMultiScanEnabled,
        isStartingScan,
        updateScanAndNavigate,
        getSource,
        setIsMultiScanEnabled,
    });

    // When the component mounts, if there is a receipt, see if the image can be read from the disk. If not, make the user star scanning flow from scratch.
    // This is because until the request is saved, the receipt file is only stored in the browsers memory as a blob:// and if the browser is refreshed, then
    // the image ceases to exist. The best way for the user to recover from this is to start over from the start of the request process.
    useEffect(() => {
        let isAllScanFilesCanBeRead = true;

        Promise.all(
            transactions.map((item) => {
                const itemReceiptPath = item.receipt?.source;
                const isLocalFile = isLocalFileFileUtils(itemReceiptPath);

                if (!isLocalFile) {
                    return Promise.resolve();
                }

                const onFailure = () => {
                    isAllScanFilesCanBeRead = false;
                };

                return checkIfScanFileCanBeRead(item.receipt?.filename, itemReceiptPath, item.receipt?.type, () => {}, onFailure);
            }),
        ).then(() => {
            if (isAllScanFilesCanBeRead) {
                return;
            }
            setIsMultiScanEnabled?.(false);
            removeTransactionReceipt(CONST.IOU.OPTIMISTIC_TRANSACTION_ID);
            removeDraftTransactions(true);
        });
        // We want this hook to run on mounting only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // this effect will pre-fetch location in web if the location permission is already granted to optimize the flow
    useEffect(() => {
        const gpsRequired = initialTransaction?.amount === 0 && iouType !== CONST.IOU.TYPE.SPLIT;
        if (!gpsRequired) {
            return;
        }

        getLocationPermission().then((status) => {
            if (status !== RESULTS.GRANTED && status !== RESULTS.LIMITED) {
                return;
            }

            clearUserLocation();
            getCurrentPosition(
                (successData) => {
                    setUserLocation({longitude: successData.coords.longitude, latitude: successData.coords.latitude});
                },
                () => {},
            );
        });
    }, [initialTransaction?.amount, iouType]);

    const handleDropReceipt = (e: DragEvent) => {
        const files = Array.from(e?.dataTransfer?.files ?? []);
        if (files.length === 0) {
            return;
        }
        for (const file of files) {
            // eslint-disable-next-line no-param-reassign
            file.uri = URL.createObjectURL(file);
        }

        validateFiles(files, Array.from(e.dataTransfer?.items ?? []));
    };

    const onCapture = useCallback(
        (file: FileObject, filename: string, source: string) => {
            const transaction =
                isMultiScanEnabled && initialTransaction?.receipt?.source
                    ? buildOptimisticTransactionAndCreateDraft({
                          initialTransaction,
                          currentUserPersonalDetails,
                          reportID,
                      })
                    : initialTransaction;
            const transactionID = transaction?.transactionID ?? initialTransactionID;
            const newReceiptFiles = [...receiptFiles, {file, source, transactionID}];

            setMoneyRequestReceipt(transactionID, source, filename, !isEditing, file.type);
            setReceiptFiles(newReceiptFiles);

            if (isMultiScanEnabled) {
                return;
            }

            if (isEditing) {
                updateScanAndNavigate(file, source);
                return;
            }

            submitReceipts(newReceiptFiles);
        },
        [isMultiScanEnabled, initialTransaction, currentUserPersonalDetails, reportID, initialTransactionID, receiptFiles, isEditing, submitReceipts, setReceiptFiles, updateScanAndNavigate],
    );

    const [containerHeight, setContainerHeight] = useState(0);
    const [desktopUploadViewHeight, setDesktopUploadViewHeight] = useState(0);
    const [alternativeMethodsHeight, setAlternativeMethodsHeight] = useState(0);
    // We use isMobileWeb here to explicitly hide the alternative methods component on both mobile web and native apps
    const chooseFilesPaddingVertical = Number(styles.chooseFilesView(!canUseDragAndDrop).paddingVertical);
    const shouldHideAlternativeMethods = isMobileWeb || alternativeMethodsHeight + desktopUploadViewHeight + chooseFilesPaddingVertical * 2 > containerHeight;

    return (
        <StepScreenDragAndDropWrapper
            headerTitle={translate('common.receipt')}
            onBackButtonPress={navigateBack}
            shouldShowWrapper={!!backTo || isEditing}
            testID="IOURequestStepScan"
        >
            {(isDraggingOverWrapper) => (
                <View
                    onLayout={(event) => {
                        setContainerHeight(event.nativeEvent.layout.height);
                        if (!onLayout) {
                            return;
                        }
                        onLayout(setTestReceiptAndNavigate);
                    }}
                    style={[styles.flex1, canUseDragAndDrop && styles.chooseFilesView(!canUseDragAndDrop)]}
                >
                    <View style={[styles.flex1, canUseDragAndDrop && styles.alignItemsCenter, styles.justifyContentCenter]}>
                        {!(isDraggingOver ?? isDraggingOverWrapper) &&
                            (isMobileWeb ? (
                                <MobileWebCameraView
                                    PDFValidationComponent={PDFValidationComponent}
                                    shouldAcceptMultipleFiles={shouldAcceptMultipleFiles}
                                    validateFiles={validateFiles}
                                    isMultiScanEnabled={isMultiScanEnabled}
                                    canUseMultiScan={canUseMultiScan}
                                    toggleMultiScan={toggleMultiScan}
                                    blinkStyle={blinkStyle}
                                    showBlink={showBlink}
                                    shouldShowMultiScanEducationalPopup={shouldShowMultiScanEducationalPopup}
                                    dismissMultiScanEducationalPopup={dismissMultiScanEducationalPopup}
                                    submitMultiScanReceipts={submitMultiScanReceipts}
                                    onCapture={onCapture}
                                />
                            ) : (
                                <DesktopWebUploadView
                                    PDFValidationComponent={PDFValidationComponent}
                                    shouldAcceptMultipleFiles={shouldAcceptMultipleFiles}
                                    validateFiles={validateFiles}
                                    setDesktopUploadViewHeight={setDesktopUploadViewHeight}
                                />
                            ))}
                    </View>
                    <DragAndDropConsumer onDrop={handleDropReceipt}>
                        <DropZoneUI
                            icon={isReplacingReceipt ? lazyIcons.ReplaceReceipt : lazyIcons.SmartScan}
                            dropStyles={styles.receiptDropOverlay(true)}
                            dropTitle={isReplacingReceipt ? translate('dropzone.replaceReceipt') : translate(shouldAcceptMultipleFiles ? 'dropzone.scanReceipts' : 'quickAction.scanReceipt')}
                            dropTextStyles={styles.receiptDropText}
                            dashedBorderStyles={[styles.dropzoneArea, styles.easeInOpacityTransition, styles.activeDropzoneDashedBorder(theme.receiptDropBorderColorActive, true)]}
                        />
                    </DragAndDropConsumer>
                    {!shouldHideAlternativeMethods && <ReceiptAlternativeMethods onLayout={(e) => setAlternativeMethodsHeight(e.nativeEvent.layout.height)} />}
                    {ErrorModal}
                    {startLocationPermissionFlow && !!receiptFiles.length && (
                        <LocationPermissionModal
                            startPermissionFlow={startLocationPermissionFlow}
                            resetPermissionFlow={() => setStartLocationPermissionFlow(false)}
                            onGrant={() => navigateToConfirmationStep(receiptFiles, true)}
                            onDeny={() => {
                                updateLastLocationPermissionPrompt();
                                navigateToConfirmationStep(receiptFiles, false);
                            }}
                        />
                    )}
                </View>
            )}
        </StepScreenDragAndDropWrapper>
    );
}

const IOURequestStepScanWithCurrentUserPersonalDetails = withCurrentUserPersonalDetails(IOURequestStepScan);
// eslint-disable-next-line rulesdir/no-negated-variables
const IOURequestStepScanWithWritableReportOrNotFound = withWritableReportOrNotFound(IOURequestStepScanWithCurrentUserPersonalDetails, true);
// eslint-disable-next-line rulesdir/no-negated-variables
const IOURequestStepScanWithFullTransactionOrNotFound = withFullTransactionOrNotFound(IOURequestStepScanWithWritableReportOrNotFound);

export default IOURequestStepScanWithFullTransactionOrNotFound;
