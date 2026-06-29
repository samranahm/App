import {findFocusedRoute} from '@react-navigation/native';
import React, {startTransition, useCallback, useEffect, useMemo, useRef} from 'react';
import type {GestureResponderEvent} from 'react-native';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import PrevNextButtons from '@components/PrevNextButtons';
import {useWideRHPActions} from '@components/WideRHPContextProvider';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useOnyx from '@hooks/useOnyx';
import {createTransactionThreadReport, setOptimisticTransactionThread} from '@libs/actions/Report';
import {clearActiveTransactionIDs} from '@libs/actions/TransactionThreadNavigation';
import type {RightModalNavigatorParamList} from '@libs/Navigation/types';
import {getOriginalMessage, isMoneyRequestAction} from '@libs/ReportActionsUtils';
import {getReportIDToOpenForExpense} from '@libs/TransactionThreadNavigationUtils';
import Navigation from '@navigation/Navigation';
import navigationRef from '@navigation/navigationRef';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import getEmptyArray from '@src/types/utils/getEmptyArray';

type MoneyRequestReportRHPNavigationButtonsProps = {
    currentTransactionID: string;
    isFromReviewDuplicates?: boolean;
};

const ADJACENT_TARGET_PREP_IDLE_TIMEOUT_MS = 500;

const parentReportActionIDsSelector = (reportActions: OnyxEntry<OnyxTypes.ReportActions>) => {
    const parentActions = new Map<string, OnyxTypes.ReportAction>();
    for (const action of Object.values(reportActions ?? {})) {
        const transactionID = isMoneyRequestAction(action) ? getOriginalMessage(action)?.IOUTransactionID : undefined;
        if (!transactionID) {
            continue;
        }
        parentActions.set(transactionID, action);
    }
    return parentActions;
};

function MoneyRequestReportTransactionsNavigation({currentTransactionID, isFromReviewDuplicates}: MoneyRequestReportRHPNavigationButtonsProps) {
    const [transactionIDsList = getEmptyArray<string>()] = useOnyx(ONYXKEYS.TRANSACTION_THREAD_NAVIGATION_TRANSACTION_IDS);
    const [siblingDescriptorsByTransactionID] = useOnyx(ONYXKEYS.TRANSACTION_THREAD_NAVIGATION_THREAD_REPORT_IDS);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const {email: currentUserEmail, accountID: currentUserAccountID} = useCurrentUserPersonalDetails();
    const {markReportIDAsExpense} = useWideRHPActions();

    const {prevTransactionID, nextTransactionID} = useMemo(() => {
        if (!transactionIDsList || transactionIDsList.length < 2) {
            return {prevTransactionID: undefined, nextTransactionID: undefined};
        }

        const currentTransactionIndex = transactionIDsList.findIndex((id) => id === currentTransactionID);

        const prevID = currentTransactionIndex > 0 ? transactionIDsList.at(currentTransactionIndex - 1) : undefined;
        const nextID = transactionIDsList.at(currentTransactionIndex + 1);

        return {
            prevTransactionID: prevID,
            nextTransactionID: nextID,
        };
    }, [currentTransactionID, transactionIDsList]);

    const prevNextTransactionsSelector = useCallback(
        (allTransactions: OnyxCollection<OnyxTypes.Transaction>) =>
            [currentTransactionID, prevTransactionID, nextTransactionID].map((transactionID) => allTransactions?.[`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`]),
        [currentTransactionID, nextTransactionID, prevTransactionID],
    );

    const [[currentTransaction, prevTransaction, nextTransaction] = getEmptyArray<OnyxTypes.Transaction>()] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION, {
        selector: prevNextTransactionsSelector,
    });

    const parentReportActionsSelector = useCallback(
        (allReportActions: OnyxCollection<OnyxTypes.ReportActions>) => {
            let reportActions = {};
            for (const transaction of [currentTransaction, prevTransaction, nextTransaction]) {
                reportActions = {...reportActions, ...allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transaction?.reportID}`]};
            }
            return parentReportActionIDsSelector(reportActions);
        },
        [currentTransaction, nextTransaction, prevTransaction],
    );

    const [parentReportActions = new Map<string, OnyxTypes.ReportAction>()] = useOnyx(ONYXKEYS.COLLECTION.REPORT_ACTIONS, {
        selector: parentReportActionsSelector,
    });

    const {prevParentReportAction, nextParentReportAction} = useMemo(() => {
        if (!transactionIDsList || transactionIDsList.length < 2) {
            return {prevParentReportAction: undefined, nextParentReportAction: undefined};
        }

        return {
            prevParentReportAction: prevTransactionID ? parentReportActions.get(prevTransactionID) : undefined,
            nextParentReportAction: nextTransactionID ? parentReportActions.get(nextTransactionID) : undefined,
        };
    }, [nextTransactionID, parentReportActions, prevTransactionID, transactionIDsList]);

    const [prevParentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${prevTransaction?.reportID}`);
    const [nextParentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${nextTransaction?.reportID}`);
    const [prevThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${prevParentReportAction?.childReportID}`);
    const [nextThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${nextParentReportAction?.childReportID}`);

    const nextTargetReportIDRef = useRef<string | undefined>(undefined);
    const prevTargetReportIDRef = useRef<string | undefined>(undefined);

    const resolveDescriptorTargetReportID = useCallback(
        (transactionID: string | undefined) => {
            const descriptor = transactionID ? siblingDescriptorsByTransactionID?.[transactionID] : undefined;
            if (!descriptor) {
                return undefined;
            }

            return getReportIDToOpenForExpense(descriptor, {introSelected, betas, currentUserEmail, currentUserAccountID});
        },
        [betas, currentUserAccountID, currentUserEmail, introSelected, siblingDescriptorsByTransactionID],
    );

    const resolveThreadTargetReportID = useCallback(
        (
            parentReportAction: OnyxEntry<OnyxTypes.ReportAction>,
            parentReport: OnyxEntry<OnyxTypes.Report>,
            threadReport: OnyxEntry<OnyxTypes.Report>,
            transaction: OnyxEntry<OnyxTypes.Transaction>,
        ) => {
            let threadReportID = parentReportAction?.childReportID;

            if (!threadReport && threadReportID) {
                setOptimisticTransactionThread(threadReportID, parentReport?.reportID, parentReportAction?.reportActionID, parentReport?.policyID);
            }

            if (!threadReportID) {
                const transactionThreadReport = createTransactionThreadReport({
                    introSelected,
                    currentUserLogin: currentUserEmail ?? '',
                    currentUserAccountID,
                    betas,
                    iouReport: parentReport,
                    iouReportAction: parentReportAction,
                    transaction,
                });
                threadReportID = transactionThreadReport?.reportID;
            }

            return threadReportID;
        },
        [betas, currentUserAccountID, currentUserEmail, introSelected],
    );

    const resolveAdjacentTargetReportID = useCallback(
        (direction: 'next' | 'prev') => {
            const transactionID = direction === 'next' ? nextTransactionID : prevTransactionID;
            const descriptorTargetReportID = resolveDescriptorTargetReportID(transactionID);
            if (descriptorTargetReportID) {
                return descriptorTargetReportID;
            }

            const parentReportAction = direction === 'next' ? nextParentReportAction : prevParentReportAction;
            const parentReport = direction === 'next' ? nextParentReport : prevParentReport;
            const threadReport = direction === 'next' ? nextThreadReport : prevThreadReport;
            const transaction = direction === 'next' ? nextTransaction : prevTransaction;

            return resolveThreadTargetReportID(parentReportAction, parentReport, threadReport, transaction);
        },
        [
            nextParentReport,
            nextParentReportAction,
            nextThreadReport,
            nextTransaction,
            nextTransactionID,
            prevParentReport,
            prevParentReportAction,
            prevThreadReport,
            prevTransaction,
            prevTransactionID,
            resolveDescriptorTargetReportID,
            resolveThreadTargetReportID,
        ],
    );

    useEffect(() => {
        nextTargetReportIDRef.current = undefined;
        prevTargetReportIDRef.current = undefined;

        if (!nextTransactionID && !prevTransactionID) {
            return;
        }

        const idleCallbackID = requestIdleCallback(
            () => {
                if (nextTransactionID) {
                    nextTargetReportIDRef.current = resolveAdjacentTargetReportID('next');
                }
                if (prevTransactionID) {
                    prevTargetReportIDRef.current = resolveAdjacentTargetReportID('prev');
                }
            },
            {timeout: ADJACENT_TARGET_PREP_IDLE_TIMEOUT_MS},
        );

        return () => cancelIdleCallback(idleCallbackID);
    }, [nextTransactionID, prevTransactionID, resolveAdjacentTargetReportID]);

    /**
     * We clear the sibling transactionThreadIDs when unmounting this component
     * only when the mount actually goes to a different SCREEN (and not a different version of the same SCREEN)
     */
    useEffect(() => {
        return () => {
            const focusedRoute = findFocusedRoute(navigationRef.getRootState());
            if (focusedRoute?.name === SCREENS.RIGHT_MODAL.SEARCH_REPORT || focusedRoute?.name === SCREENS.TRANSACTION_DUPLICATE.REVIEW) {
                return;
            }
            clearActiveTransactionIDs();
        };
    }, []);

    const getBackTo = () => {
        let backTo = Navigation.getActiveRoute();
        if (isFromReviewDuplicates) {
            const currentRoute = navigationRef.getCurrentRoute();
            const params = currentRoute?.params as RightModalNavigatorParamList[typeof SCREENS.RIGHT_MODAL.SEARCH_REPORT] | undefined;
            backTo = params?.backTo ?? backTo;
        }
        return backTo;
    };

    const navigateToTargetReportID = useCallback(
        (targetReportID: string | undefined, backTo: string) => {
            if (!targetReportID) {
                return;
            }

            markReportIDAsExpense(targetReportID);
            requestAnimationFrame(() => {
                startTransition(() => Navigation.setParams({reportID: targetReportID, reportActionID: undefined, backTo}));
            });
        },
        [markReportIDAsExpense],
    );

    const navigateToAdjacentTarget = useCallback(
        (direction: 'next' | 'prev', backTo: string) => {
            const cachedTargetReportID = direction === 'next' ? nextTargetReportIDRef.current : prevTargetReportIDRef.current;
            if (cachedTargetReportID) {
                navigateToTargetReportID(cachedTargetReportID, backTo);
                return;
            }

            requestIdleCallback(
                () => {
                    const targetReportID = resolveAdjacentTargetReportID(direction);
                    if (direction === 'next') {
                        nextTargetReportIDRef.current = targetReportID;
                    } else {
                        prevTargetReportIDRef.current = targetReportID;
                    }
                    navigateToTargetReportID(targetReportID, backTo);
                },
                {timeout: ADJACENT_TARGET_PREP_IDLE_TIMEOUT_MS},
            );
        },
        [navigateToTargetReportID, resolveAdjacentTargetReportID],
    );

    if (transactionIDsList.length < 2) {
        return;
    }

    const onNext = (e: GestureResponderEvent | KeyboardEvent | undefined) => {
        e?.preventDefault();
        navigateToAdjacentTarget('next', getBackTo());
    };

    const onPrevious = (e: GestureResponderEvent | KeyboardEvent | undefined) => {
        e?.preventDefault();
        navigateToAdjacentTarget('prev', getBackTo());
    };

    return (
        <PrevNextButtons
            isPrevButtonDisabled={!prevTransactionID}
            isNextButtonDisabled={!nextTransactionID}
            onNext={onNext}
            onPrevious={onPrevious}
            prevButtonSentryLabel={CONST.SENTRY_LABEL.PREV_NEXT_BUTTONS.PREV_BUTTON_TRANSACTION_THREAD}
            nextButtonSentryLabel={CONST.SENTRY_LABEL.PREV_NEXT_BUTTONS.NEXT_BUTTON_TRANSACTION_THREAD}
        />
    );
}

export default MoneyRequestReportTransactionsNavigation;
