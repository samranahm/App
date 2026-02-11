import reportsSelector from '@selectors/Attributes';
import {hasSeenTourSelector} from '@selectors/Onboarding';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {InteractionManager} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import useDefaultExpensePolicy from '@hooks/useDefaultExpensePolicy';
import useFilesValidation from '@hooks/useFilesValidation';
import useIOUUtils from '@hooks/useIOUUtils';
import useOnyx from '@hooks/useOnyx';
import useOptimisticDraftTransactions from '@hooks/useOptimisticDraftTransactions';
import usePermissions from '@hooks/usePermissions';
import usePersonalPolicy from '@hooks/usePersonalPolicy';
import usePolicy from '@hooks/usePolicy';
import usePolicyForMovingExpenses from '@hooks/usePolicyForMovingExpenses';
import useSelfDMReport from '@hooks/useSelfDMReport';
import {handleMoneyRequestStepScanParticipants} from '@libs/actions/IOU/MoneyRequest';
import {dismissProductTraining} from '@libs/actions/Welcome';
import {isArchivedReport, isPolicyExpenseChat} from '@libs/ReportUtils';
import {getDefaultTaxCode, hasReceipt, shouldReuseInitialTransaction} from '@libs/TransactionUtils';
import {setMoneyRequestReceipt} from '@userActions/IOU';
import {buildOptimisticTransactionAndCreateDraft, removeDraftTransactions, removeTransactionReceipt} from '@userActions/TransactionEdit';
import type {IOUAction, IOUType} from '@src/CONST';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import type {Report} from '@src/types/onyx';
import type {CurrentUserPersonalDetails} from '@src/types/onyx/PersonalDetails';
import type Transaction from '@src/types/onyx/Transaction';
import type {FileObject} from '@src/types/utils/Attachment';
import type {ReceiptFile} from './types';

type UseReceiptScanParams = {
    /** The report associated with this money request */
    report: OnyxEntry<Report>;

    /** The ID of the report */
    reportID: string;

    /** The ID of the initial transaction */
    initialTransactionID: string;

    /** The initial transaction object */
    initialTransaction: OnyxEntry<Transaction>;

    /** The type of IOU request (submit, track, split, etc.) */
    iouType: IOUType;

    /** The action being performed (create, edit) */
    action: IOUAction;

    /** Current user personal details */
    currentUserPersonalDetails: CurrentUserPersonalDetails;

    /** Route to navigate back to */
    backTo?: Route;

    /** Whether to navigate back to the report */
    backToReport?: string;

    /** Whether multi-scan is enabled (passed from parent) */
    isMultiScanEnabled?: boolean;

    /** Whether the user is starting a scan request */
    isStartingScan?: boolean;

    /** Callback to update multi-scan enabled state in parent */
    setIsMultiScanEnabled?: (value: boolean) => void;

    /** Callback to navigate back */
    navigateBack: () => void;

    /** Callback to replace receipt and navigate back when editing */
    updateScanAndNavigate: (file: FileObject, source: string) => void;
};

function useReceiptScan({
    report,
    reportID,
    initialTransactionID,
    initialTransaction,
    iouType,
    action,
    currentUserPersonalDetails,
    backTo,
    backToReport,
    isMultiScanEnabled = false,
    isStartingScan = false,
    setIsMultiScanEnabled,
    navigateBack,
    updateScanAndNavigate,
}: UseReceiptScanParams) {
    const {isBetaEnabled} = usePermissions();
    const {shouldStartLocationPermissionFlow} = useIOUUtils();

    const [reportNameValuePairs] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report?.reportID}`, {canBeMissing: true});
    const policy = usePolicy(report?.policyID);
    const {policyForMovingExpenses} = usePolicyForMovingExpenses();
    const personalPolicy = usePersonalPolicy();
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {canBeMissing: false});
    const [skipConfirmation] = useOnyx(`${ONYXKEYS.COLLECTION.SKIP_CONFIRMATION}${initialTransactionID}`, {canBeMissing: true});
    const defaultExpensePolicy = useDefaultExpensePolicy();
    const [dismissedProductTraining] = useOnyx(ONYXKEYS.NVP_DISMISSED_PRODUCT_TRAINING, {canBeMissing: true});
    const [quickAction] = useOnyx(ONYXKEYS.NVP_QUICK_ACTION_GLOBAL_CREATE, {canBeMissing: true});
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {canBeMissing: true, selector: reportsSelector});
    const [policyRecentlyUsedCurrencies] = useOnyx(ONYXKEYS.RECENTLY_USED_CURRENCIES, {canBeMissing: true});
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED, {canBeMissing: true});
    const [activePolicyID] = useOnyx(ONYXKEYS.NVP_ACTIVE_POLICY_ID, {canBeMissing: true});
    const [isSelfTourViewed = false] = useOnyx(ONYXKEYS.NVP_ONBOARDING, {canBeMissing: true, selector: hasSeenTourSelector});
    const [betas] = useOnyx(ONYXKEYS.BETAS, {canBeMissing: true});
    const [transactionViolations] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS, {canBeMissing: true});
    const [transactions, optimisticTransactions] = useOptimisticDraftTransactions(initialTransaction);
    const selfDMReport = useSelfDMReport();

    const isEditing = action === CONST.IOU.ACTION.EDIT;
    const canUseMultiScan = isStartingScan && iouType !== CONST.IOU.TYPE.SPLIT;
    const isArchived = isArchivedReport(reportNameValuePairs);
    const isReplacingReceipt = (isEditing && hasReceipt(initialTransaction)) || (!!initialTransaction?.receipt && !!backTo);
    const shouldAcceptMultipleFiles = !isEditing && !backTo;
    const shouldGenerateTransactionThreadReport = !isBetaEnabled(CONST.BETAS.NO_OPTIMISTIC_TRANSACTION_THREADS);
    const isASAPSubmitBetaEnabled = isBetaEnabled(CONST.BETAS.ASAP_SUBMIT);

    const defaultTaxCode = getDefaultTaxCode(policy, initialTransaction);
    const transactionTaxCode = (initialTransaction?.taxCode ? initialTransaction?.taxCode : defaultTaxCode) ?? '';
    const transactionTaxAmount = initialTransaction?.taxAmount ?? 0;

    // For quick button actions, we'll skip the confirmation page unless the report is archived or this is a workspace
    // request and the workspace requires a category or a tag
    const shouldSkipConfirmation: boolean = useMemo(() => {
        if (!skipConfirmation || !report?.reportID) {
            return false;
        }

        return !isArchived && !(isPolicyExpenseChat(report) && ((policy?.requiresCategory ?? false) || (policy?.requiresTag ?? false)));
    }, [report, skipConfirmation, policy?.requiresCategory, policy?.requiresTag, isArchived]);

    const [startLocationPermissionFlow, setStartLocationPermissionFlow] = useState(false);
    const [receiptFiles, setReceiptFiles] = useState<ReceiptFile[]>([]);
    const [shouldShowMultiScanEducationalPopup, setShouldShowMultiScanEducationalPopup] = useState(false);

    // Clear receipt files when multi-scan is disabled
    useEffect(() => {
        if (isMultiScanEnabled) {
            return;
        }
        setReceiptFiles([]);
    }, [isMultiScanEnabled]);

    const navigateToConfirmationStep = useCallback(
        (files: ReceiptFile[], locationPermissionGranted = false, isTestTransaction = false) => {
            handleMoneyRequestStepScanParticipants({
                iouType,
                policy,
                report,
                reportID,
                reportAttributesDerived,
                transactions,
                initialTransaction: {
                    transactionID: initialTransactionID,
                    reportID: initialTransaction?.reportID,
                    taxCode: transactionTaxCode,
                    taxAmount: transactionTaxAmount,
                    currency: initialTransaction?.currency,
                    isFromGlobalCreate: initialTransaction?.isFromGlobalCreate,
                    participants: initialTransaction?.participants,
                },
                personalDetails,
                currentUserLogin: currentUserPersonalDetails.login,
                currentUserAccountID: currentUserPersonalDetails.accountID,
                backTo,
                backToReport,
                shouldSkipConfirmation,
                defaultExpensePolicy,
                shouldGenerateTransactionThreadReport,
                isArchivedExpenseReport: isArchived,
                isAutoReporting: !!personalPolicy?.autoReporting,
                isASAPSubmitBetaEnabled,
                transactionViolations,
                quickAction,
                policyRecentlyUsedCurrencies,
                introSelected,
                activePolicyID,
                privateIsArchived: reportNameValuePairs?.private_isArchived,
                files,
                isTestTransaction,
                locationPermissionGranted,
                selfDMReport,
                policyForMovingExpenses,
                isSelfTourViewed,
                betas,
            });
        },
        [
            iouType,
            policy,
            report,
            reportID,
            reportAttributesDerived,
            transactions,
            initialTransactionID,
            initialTransaction?.reportID,
            initialTransaction?.currency,
            initialTransaction?.isFromGlobalCreate,
            initialTransaction?.participants,
            transactionTaxCode,
            transactionTaxAmount,
            personalDetails,
            currentUserPersonalDetails.login,
            currentUserPersonalDetails.accountID,
            backTo,
            backToReport,
            shouldSkipConfirmation,
            defaultExpensePolicy,
            shouldGenerateTransactionThreadReport,
            isArchived,
            personalPolicy?.autoReporting,
            selfDMReport,
            isASAPSubmitBetaEnabled,
            transactionViolations,
            quickAction,
            policyRecentlyUsedCurrencies,
            introSelected,
            activePolicyID,
            reportNameValuePairs?.private_isArchived,
            policyForMovingExpenses,
            isSelfTourViewed,
            betas,
        ],
    );

    /**
     * Processes receipt files and navigates to confirmation step
     */
    const processReceipts = useCallback(
        (files: FileObject[], getSource: (file: FileObject) => string) => {
            if (files.length === 0) {
                return;
            }
            // Store the receipt on the transaction object in Onyx
            const newReceiptFiles: ReceiptFile[] = [];

            if (isEditing) {
                const file = files.at(0);
                if (!file) {
                    return;
                }
                const source = getSource(file);
                setMoneyRequestReceipt(initialTransactionID, source, file.name ?? '', !isEditing, file.type);
                updateScanAndNavigate(file, source);
                return;
            }

            if (!isMultiScanEnabled && isStartingScan) {
                removeDraftTransactions(true);
            }

            for (const [index, file] of files.entries()) {
                const source = getSource(file);
                const transaction = shouldReuseInitialTransaction(initialTransaction, shouldAcceptMultipleFiles, index, isMultiScanEnabled, transactions)
                    ? (initialTransaction as Partial<Transaction>)
                    : buildOptimisticTransactionAndCreateDraft({
                          initialTransaction: initialTransaction as Partial<Transaction>,
                          currentUserPersonalDetails,
                          reportID,
                      });

                const transactionID = transaction.transactionID ?? initialTransactionID;
                newReceiptFiles.push({file, source, transactionID});
                setMoneyRequestReceipt(transactionID, source, file.name ?? '', true, file.type);
            }

            if (shouldSkipConfirmation) {
                setReceiptFiles(newReceiptFiles);
                const gpsRequired = initialTransaction?.amount === 0 && iouType !== CONST.IOU.TYPE.SPLIT && files.length;
                if (gpsRequired) {
                    const beginLocationPermissionFlow = shouldStartLocationPermissionFlow();

                    if (beginLocationPermissionFlow) {
                        setStartLocationPermissionFlow(true);
                        return;
                    }
                }
            }
            navigateToConfirmationStep(newReceiptFiles, false);
        },
        [
            isEditing,
            isMultiScanEnabled,
            isStartingScan,
            initialTransaction,
            shouldAcceptMultipleFiles,
            transactions,
            currentUserPersonalDetails,
            reportID,
            initialTransactionID,
            shouldSkipConfirmation,
            iouType,
            shouldStartLocationPermissionFlow,
            navigateToConfirmationStep,
            updateScanAndNavigate,
        ],
    );

    const {validateFiles, PDFValidationComponent, ErrorModal} = useFilesValidation((files: FileObject[]) => {
        processReceipts(files, (file) => {
            if (file.uri) {
                return file.uri;
            }
            return URL.createObjectURL(file as Blob);
        });
    });

    const submitReceipts = useCallback(
        (files: ReceiptFile[]) => {
            if (shouldSkipConfirmation) {
                const gpsRequired = initialTransaction?.amount === 0 && iouType !== CONST.IOU.TYPE.SPLIT;
                if (gpsRequired) {
                    const beginLocationPermissionFlow = shouldStartLocationPermissionFlow();
                    if (beginLocationPermissionFlow) {
                        setStartLocationPermissionFlow(true);
                        return;
                    }
                }
            }
            navigateToConfirmationStep(files, false);
        },
        [shouldSkipConfirmation, navigateToConfirmationStep, initialTransaction?.amount, iouType, shouldStartLocationPermissionFlow],
    );

    const submitMultiScanReceipts = useCallback(() => {
        const transactionIDs = new Set(optimisticTransactions?.map((transaction) => transaction?.transactionID));
        const validReceiptFiles = receiptFiles.filter((receiptFile) => transactionIDs.has(receiptFile.transactionID));
        submitReceipts(validReceiptFiles);
    }, [optimisticTransactions, receiptFiles, submitReceipts]);

    const toggleMultiScan = useCallback(() => {
        if (!dismissedProductTraining?.[CONST.PRODUCT_TRAINING_TOOLTIP_NAMES.MULTI_SCAN_EDUCATIONAL_MODAL]) {
            setShouldShowMultiScanEducationalPopup(true);
        }
        removeTransactionReceipt(CONST.IOU.OPTIMISTIC_TRANSACTION_ID);
        removeDraftTransactions(true);
        setIsMultiScanEnabled?.(!isMultiScanEnabled);
    }, [dismissedProductTraining, isMultiScanEnabled, setIsMultiScanEnabled]);

    const dismissMultiScanEducationalPopup = useCallback(() => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        InteractionManager.runAfterInteractions(() => {
            dismissProductTraining(CONST.PRODUCT_TRAINING_TOOLTIP_NAMES.MULTI_SCAN_EDUCATIONAL_MODAL);
            setShouldShowMultiScanEducationalPopup(false);
        });
    }, []);

    return {
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
    };
}

export default useReceiptScan;
export type {UseReceiptScanParams};
