import Button from '@components/ButtonComposed';

import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useTransactionsAndViolationsForReport from '@hooks/useTransactionsAndViolationsForReport';

import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {getThreadReportIDsForTransactions} from '@libs/MoneyRequestReportUtils';
import createDynamicRoute from '@libs/Navigation/helpers/dynamicRoutesUtils/createDynamicRoute';
import Navigation from '@libs/Navigation/Navigation';
import {getIOUActionForTransactionID} from '@libs/ReportActionsUtils';
import {isDuplicate} from '@libs/TransactionUtils';

import {createTransactionThreadReport, setOptimisticTransactionThread} from '@userActions/Report';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {DYNAMIC_ROUTES} from '@src/ROUTES';
import {personalDetailsLoginSelector} from '@src/selectors/PersonalDetails';
import type {ReportAction} from '@src/types/onyx';

import React from 'react';

import type {SimpleActionProps} from './types';

import useTransactionThreadData from './useTransactionThreadData';

function ReviewDuplicatesPrimaryAction({reportID, chatReportID}: SimpleActionProps) {
    const {translate} = useLocalize();
    const {accountID, email} = useCurrentUserPersonalDetails();

    const {moneyRequestReport, reportActions, transactionThreadReportID, transactionThreadReport} = useTransactionThreadData(reportID, chatReportID);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${getNonEmptyStringOnyxID(moneyRequestReport?.policyID)}`);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const [allTransactionViolations] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS);
    const [ownerLogin] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {selector: personalDetailsLoginSelector(moneyRequestReport?.ownerAccountID)});

    const {transactions: reportTransactionsMap} = useTransactionsAndViolationsForReport(moneyRequestReport?.reportID);
    const transactions = Object.values(reportTransactionsMap);

    const findDuplicateTransaction = () =>
        transactions.find((reportTransaction) =>
            isDuplicate(
                reportTransaction,
                email ?? '',
                accountID,
                moneyRequestReport,
                ownerLogin,
                policy,
                allTransactionViolations?.[ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS + reportTransaction.transactionID],
            ),
        );

    const getIOUActionForThreadID = (threadID: string, preferredTransactionID?: string): ReportAction | undefined => {
        if (preferredTransactionID) {
            const preferredAction = getIOUActionForTransactionID(reportActions ?? [], preferredTransactionID);
            if (preferredAction) {
                return preferredAction;
            }
        }

        // When the thread report is absent, requestParentReportAction from the hook is also null. Resolve the parent IOU action from the
        // expense report actions we already have by matching childReportID.
        return (reportActions ?? []).find((action) => action.childReportID === threadID);
    };

    const navigateToDuplicateReview = (threadID: string) => {
        // Wait a frame so Onyx has applied setOptimisticTransactionThread / createTransactionThreadReport
        // before DynamicReviewPage mounts and reads the thread report.
        requestAnimationFrame(() => {
            Navigation.navigate(createDynamicRoute(DYNAMIC_ROUTES.TRANSACTION_DUPLICATE_REVIEW.getRoute(threadID)));
        });
    };

    const seedExistingThreadAndNavigate = (threadID: string, iouAction: ReportAction | undefined) => {
        setOptimisticTransactionThread(threadID, moneyRequestReport?.reportID, iouAction?.reportActionID, moneyRequestReport?.policyID);
        navigateToDuplicateReview(threadID);
    };

    return (
        <Button
            variant={CONST.BUTTON_VARIANT.SUCCESS}
            onPress={() => {
                if (transactionThreadReportID) {
                    if (transactionThreadReport?.reportID) {
                        navigateToDuplicateReview(transactionThreadReportID);
                        return;
                    }
                    const duplicateTransaction = findDuplicateTransaction();
                    seedExistingThreadAndNavigate(transactionThreadReportID, getIOUActionForThreadID(transactionThreadReportID, duplicateTransaction?.transactionID));
                    return;
                }

                const duplicateTransaction = findDuplicateTransaction();
                if (!duplicateTransaction) {
                    return;
                }

                const iouAction = getIOUActionForTransactionID(reportActions ?? [], duplicateTransaction.transactionID);
                const existingThreadID = getThreadReportIDsForTransactions(reportActions, [duplicateTransaction]).at(0) ?? iouAction?.childReportID;

                if (existingThreadID) {
                    seedExistingThreadAndNavigate(existingThreadID, iouAction ?? getIOUActionForThreadID(existingThreadID, duplicateTransaction.transactionID));
                    return;
                }

                const createdTransactionThreadReport = createTransactionThreadReport({
                    introSelected,
                    currentUserLogin: email ?? '',
                    currentUserAccountID: accountID,
                    betas,
                    iouReport: moneyRequestReport,
                    iouReportAction: iouAction,
                    transaction: duplicateTransaction,
                });
                const createdThreadID = createdTransactionThreadReport?.reportID;
                if (createdThreadID) {
                    navigateToDuplicateReview(createdThreadID);
                }
            }}
        >
            <Button.Text>{translate('iou.reviewDuplicates')}</Button.Text>
        </Button>
    );
}

export default ReviewDuplicatesPrimaryAction;
