import {Str} from 'expensify-common';
import {useCallback, useMemo, useState} from 'react';
import type {OnyxCollection} from 'react-native-onyx';
import getLastRoute from '@components/Navigation/NavigationTabBar/getLastRoute';
import type {SearchQueryItem} from '@components/Search/SearchList/ListItem/SearchQueryListItem';
import {startDistanceRequest, startMoneyRequest} from '@libs/actions/IOU/MoneyRequest';
import {createNewReport, startNewChat} from '@libs/actions/Report';
import clearSelectedText from '@libs/clearSelectedText/clearSelectedText';
import getIconForAction from '@libs/getIconForAction';
import interceptAnonymousUser from '@libs/interceptAnonymousUser';
import getCreateReportRoute, {getReportsRootRoute, navigateToCreateReportWorkspaceSelection} from '@libs/Navigation/helpers/getCreateReportRoute';
import Navigation from '@libs/Navigation/Navigation';
import navigationRef from '@libs/Navigation/navigationRef';
import {openTravelDotLink, shouldOpenTravelDotLinkWeb} from '@libs/openTravelDotLink';
import Permissions from '@libs/Permissions';
import {
    canSendInvoice as canSendInvoicePolicyUtils,
    getDefaultChatEnabledPolicy,
    isGroupPolicy,
    // eslint-disable-next-line no-restricted-imports -- Travel booking requires a paid group policy, matching TravelMenuItem
    isPaidGroupPolicy,
    shouldShowPolicy,
} from '@libs/PolicyUtils';
import {generateReportID, hasViolations as hasViolationsReportUtils} from '@libs/ReportUtils';
import {buildCannedSearchQuery, buildSearchQueryJSON, buildSearchQueryString} from '@libs/SearchQueryUtils';
import {ACCOUNT_MENU_EXCLUDED_TRANSLATION_KEYS, filterNavigationSuggestions} from '@libs/SearchRouterNavigationUtils';
import type {NavigationSuggestionSource} from '@libs/SearchRouterNavigationUtils';
import {useIsAgentAccount} from '@libs/SessionUtils';
import {startSpan} from '@libs/telemetry/activeSpans';
import {startNavigateToReportsSpans} from '@libs/telemetry/navigateToReportsSpans';
import {buildWorkspaceSearchRouterNavigationItems} from '@libs/WorkspaceMenuUtils';
import type {WorkspaceNavigationIcons} from '@libs/WorkspaceMenuUtils';
import isOnSearchMoneyRequestReportPage from '@navigation/helpers/isOnSearchMoneyRequestReportPage';
import {clearLastSearchParams} from '@userActions/ReportNavigation';
import {setSearchContext} from '@userActions/Search';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import {primaryLoginSelector} from '@src/selectors/Account';
import {emailSelector, sessionEmailAndAccountIDSelector} from '@src/selectors/Session';
import {validTransactionDraftIDsSelector} from '@src/selectors/TransactionDraft';
import type {Policy} from '@src/types/onyx';
import type IconAsset from '@src/types/utils/IconAsset';
import useCreateReport from './useCreateReport';
import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import {useMemoizedLazyExpensifyIcons} from './useLazyAsset';
import useLocalize from './useLocalize';
import useOnyx from './useOnyx';
import usePermissions from './usePermissions';
import usePreferredPolicy from './usePreferredPolicy';
import useResponsiveLayout from './useResponsiveLayout';
import useRestoreWorkspacesTabOnNavigate from './useRestoreWorkspacesTabOnNavigate';
import useSearchTypeMenuSections from './useSearchTypeMenuSections';
import useSubscriptionPlan from './useSubscriptionPlan';

type UseSearchRouterNavigationSuggestionsParams = {
    query: string;
};

function getStringParam(params: unknown, key: string): string | undefined {
    if (!params || typeof params !== 'object') {
        return undefined;
    }
    for (const [paramKey, value] of Object.entries(params)) {
        if (paramKey === key && typeof value === 'string') {
            return value;
        }
    }
    return undefined;
}

const chatEnabledPaidGroupPoliciesSelector = (policies: OnyxCollection<Policy>, currentUserLogin: string | undefined) => {
    if (!policies) {
        return CONST.EMPTY_ARRAY;
    }
    const result: Policy[] = [];
    for (const policy of Object.values(policies)) {
        if (!policy?.isPolicyExpenseChatEnabled || policy?.isJoinRequestPending || !isGroupPolicy(policy) || !shouldShowPolicy(policy, false, currentUserLogin)) {
            continue;
        }
        result.push(policy);
        if (result.length === 2) {
            break;
        }
    }
    return result;
};

function useSearchRouterNavigationSuggestions({query}: UseSearchRouterNavigationSuggestionsParams): SearchQueryItem[] {
    const {translate} = useLocalize();
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const {isBetaEnabled} = usePermissions();
    const {isRestrictedPolicyCreation} = usePreferredPolicy();
    const navigateToWorkspaces = useRestoreWorkspacesTabOnNavigate();
    const {login: currentUserLogin, accountID: currentUserAccountID} = useCurrentUserPersonalDetails();
    const {typeMenuSections} = useSearchTypeMenuSections();
    const isAgentAccount = useIsAgentAccount();
    const subscriptionPlan = useSubscriptionPlan();
    const [createMenuReportID] = useState(() => generateReportID());

    const expensifyIcons = useMemoizedLazyExpensifyIcons([
        'Home',
        'Inbox',
        'ReceiptMultiple',
        'Buildings',
        'Profile',
        'Coins',
        'Receipt',
        'Cash',
        'Transfer',
        'MoneyCircle',
        'Location',
        'Document',
        'ChatBubble',
        'InvoiceGeneric',
        'Suitcase',
        'NewWorkspace',
        'Building',
        'Car',
        'ExpensifyCard',
        'Feed',
        'Gear',
        'Hashtag',
        'Sync',
        'Tag',
        'Users',
        'Workflows',
        'LuggageWithLines',
        'Clock',
        'Bolt',
        'Wallet',
        'Lock',
        'Bot',
        'CreditCard',
        'QuestionMark',
        'Info',
        'Lightbulb',
        'Folder',
        'CalendarSolid',
        'MoneyBag',
        'MoneyHourglass',
        'CreditCardHourglass',
        'Bank',
        'User',
        'Basket',
        'Pencil',
        'ThumbsUp',
        'CheckCircle',
    ]);

    const spendTabTitle = translate('common.spend');
    const accountTabTitle = translate('initialSettingsPage.account');

    const [lastSearchParams] = useOnyx(ONYXKEYS.REPORT_NAVIGATION_LAST_SEARCH_QUERY);
    const [allPolicies] = useOnyx(ONYXKEYS.COLLECTION.POLICY);
    const [session] = useOnyx(ONYXKEYS.SESSION, {selector: sessionEmailAndAccountIDSelector});
    const [sessionEmail] = useOnyx(ONYXKEYS.SESSION, {selector: emailSelector});
    const [amountOwed = 0] = useOnyx(ONYXKEYS.NVP_PRIVATE_AMOUNT_OWED);
    const [draftTransactionIDs] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_DRAFT, {selector: validTransactionDraftIDsSelector});
    const [lastDistanceExpenseType] = useOnyx(ONYXKEYS.NVP_LAST_DISTANCE_EXPENSE_TYPE);
    const [activePolicyID] = useOnyx(ONYXKEYS.NVP_ACTIVE_POLICY_ID);
    const [activePolicy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${activePolicyID}`);
    const [travelSettings] = useOnyx(ONYXKEYS.NVP_TRAVEL_SETTINGS);
    const [primaryLogin] = useOnyx(ONYXKEYS.ACCOUNT, {selector: primaryLoginSelector});
    const [allBetas] = useOnyx(ONYXKEYS.BETAS);
    const [transactionViolations] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS);
    const [isLoadingApp = false] = useOnyx(ONYXKEYS.IS_LOADING_APP);

    const navigateToSpend = useCallback(() => {
        clearSelectedText();
        interceptAnonymousUser(() => {
            startSpan(CONST.TELEMETRY.SPAN_NAVIGATE_TO_REPORTS, {
                name: CONST.TELEMETRY.SPAN_NAVIGATE_TO_REPORTS,
                op: CONST.TELEMETRY.SPAN_NAVIGATE_TO_REPORTS,
                forceTransaction: true,
            });
            startNavigateToReportsSpans();

            const lastSearchRoute = navigationRef.isReady() ? getLastRoute(navigationRef.getRootState(), NAVIGATORS.SEARCH_FULLSCREEN_NAVIGATOR, SCREENS.SEARCH.ROOT) : undefined;

            if (lastSearchRoute) {
                const searchQueryParam = getStringParam(lastSearchRoute.params, 'q');
                const queryJSON = searchQueryParam ? buildSearchQueryJSON(searchQueryParam) : undefined;
                if (queryJSON) {
                    const searchQuery = buildSearchQueryString(queryJSON);
                    const name = getStringParam(lastSearchRoute.params, 'name');
                    const groupBy = getStringParam(lastSearchRoute.params, 'groupBy');
                    const rawQuery = getStringParam(lastSearchRoute.params, 'rawQuery');
                    setSearchContext(true);
                    Navigation.navigate(
                        ROUTES.SEARCH_ROOT.getRoute({
                            query: searchQuery,
                            ...(name ? {name} : {}),
                            ...(groupBy ? {groupBy} : {}),
                            ...(rawQuery ? {rawQuery} : {}),
                        }),
                    );
                    return;
                }
            }

            const lastQueryJSON = lastSearchParams?.queryJSON;
            const lastQueryFromOnyx = lastQueryJSON ? buildSearchQueryString(lastQueryJSON) : undefined;
            const defaultSearchQuery = buildCannedSearchQuery({type: CONST.SEARCH.DATA_TYPES.EXPENSE});
            setSearchContext(true);
            Navigation.navigate(ROUTES.SEARCH_ROOT.getRoute({query: lastQueryFromOnyx ?? defaultSearchQuery}));
        });
    }, [lastSearchParams?.queryJSON]);

    const navigateToInbox = useCallback(() => {
        startSpan(CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB, {
            name: CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB,
            op: CONST.TELEMETRY.SPAN_NAVIGATE_TO_INBOX_TAB,
        });

        if (!shouldUseNarrowLayout && navigationRef.isReady()) {
            const lastRoute = getLastRoute(navigationRef.getRootState(), NAVIGATORS.REPORTS_SPLIT_NAVIGATOR, SCREENS.REPORT);
            const reportID = getStringParam(lastRoute?.params, 'reportID');
            if (reportID) {
                const reportActionID = getStringParam(lastRoute?.params, 'reportActionID');
                const referrer = getStringParam(lastRoute?.params, 'referrer');
                const backTo = getStringParam(lastRoute?.params, 'backTo');
                Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(reportID, reportActionID, referrer, backTo));
                return;
            }
        }

        Navigation.navigate(ROUTES.INBOX);
    }, [shouldUseNarrowLayout]);

    const navigateToAccount = useCallback(() => {
        interceptAnonymousUser(() => {
            Navigation.navigate(ROUTES.SETTINGS);
        });
    }, []);

    const onNavigate = useCallback((route: Route) => {
        Navigation.navigate(route);
    }, []);

    const workspaceIcons = expensifyIcons as WorkspaceNavigationIcons;
    const groupPoliciesWithChatEnabled = chatEnabledPaidGroupPoliciesSelector(allPolicies, sessionEmail);
    const defaultChatEnabledPolicy = getDefaultChatEnabledPolicy(groupPoliciesWithChatEnabled, activePolicy);
    const isReportInSearch = isOnSearchMoneyRequestReportPage();
    const isASAPSubmitBetaEnabled = isBetaEnabled(CONST.BETAS.ASAP_SUBMIT);
    const hasViolations = hasViolationsReportUtils(undefined, transactionViolations, session?.accountID ?? CONST.DEFAULT_NUMBER_ID, session?.email ?? '');
    const canSendInvoice = canSendInvoicePolicyUtils(allPolicies, sessionEmail);
    const isBlockedFromSpotnanaTravel = Permissions.isBetaEnabled(CONST.BETAS.PREVENT_SPOTNANA_TRAVEL, allBetas);
    const primaryContactMethod = primaryLogin ?? sessionEmail ?? '';
    const isPolicyProvisioned = activePolicy?.travelSettings?.spotnanaCompanyID ?? activePolicy?.travelSettings?.associatedTravelDomainAccountID;
    const isTravelEnabled =
        !isBlockedFromSpotnanaTravel &&
        !!primaryContactMethod &&
        !Str.isSMSLogin(primaryContactMethod) &&
        isPaidGroupPolicy(activePolicy) &&
        (activePolicy?.travelSettings?.hasAcceptedTerms ?? (travelSettings?.hasAcceptedTerms && isPolicyProvisioned));
    const shouldShowNewWorkspaceButton = !isRestrictedPolicyCreation && Object.values(allPolicies ?? {}).every((policy) => !shouldShowPolicy(policy, false, sessionEmail));

    const handleCreateWorkspaceReport = useCallback(
        (shouldDismissEmptyReportsConfirmation?: boolean) => {
            if (!defaultChatEnabledPolicy?.id) {
                return;
            }

            if (isReportInSearch) {
                clearLastSearchParams();
            }

            const {reportID: createdReportID} = createNewReport(
                {accountID: currentUserAccountID, login: currentUserLogin},
                hasViolations,
                isASAPSubmitBetaEnabled,
                defaultChatEnabledPolicy,
                allBetas,
                false,
                shouldDismissEmptyReportsConfirmation,
            );
            Navigation.navigate(getReportsRootRoute(), {forceReplace: isReportInSearch});
            Navigation.setNavigationActionToMicrotaskQueue(() => {
                Navigation.navigate(getCreateReportRoute({reportID: createdReportID}), {forceReplace: isReportInSearch});
            });
        },
        [allBetas, currentUserAccountID, currentUserLogin, defaultChatEnabledPolicy, hasViolations, isASAPSubmitBetaEnabled, isReportInSearch],
    );

    const {createReport, isVisible: isCreateReportVisible} = useCreateReport({
        onCreateReport: handleCreateWorkspaceReport,
        groupPoliciesWithChatEnabled,
        onNavigateToWorkspaceSelection: () => navigateToCreateReportWorkspaceSelection({forceReplace: isReportInSearch}),
        shouldHandleNavigationBack: false,
    });

    const accountMenuSuggestions = useMemo((): NavigationSuggestionSource[] => {
        const accountItems: Array<{translationKey: TranslationPaths; icon: IconAsset; action: () => void}> = [
            {
                translationKey: 'common.profile',
                icon: expensifyIcons.Profile,
                action: () => Navigation.navigate(ROUTES.SETTINGS_PROFILE.getRoute()),
            },
        ];

        if (!isAgentAccount) {
            accountItems.push({
                translationKey: 'common.wallet',
                icon: expensifyIcons.Wallet,
                action: () => Navigation.navigate(ROUTES.SETTINGS_WALLET),
            });
        }

        if (!isAgentAccount && (subscriptionPlan || (amountOwed ?? 0) > 0)) {
            accountItems.push({
                translationKey: 'allSettingsScreen.subscription',
                icon: expensifyIcons.CreditCard,
                action: () => Navigation.navigate(ROUTES.SETTINGS_SUBSCRIPTION.route),
            });
        }

        accountItems.push({
            translationKey: 'expenseRulesPage.title',
            icon: expensifyIcons.Bolt,
            action: () => Navigation.navigate(ROUTES.SETTINGS_RULES),
        });

        if (!isAgentAccount && isBetaEnabled(CONST.BETAS.CUSTOM_AGENT)) {
            accountItems.push({
                translationKey: 'agentsPage.title',
                icon: expensifyIcons.Bot,
                action: () => Navigation.navigate(ROUTES.SETTINGS_AGENTS),
            });
        }

        if (!isAgentAccount) {
            accountItems.push({
                translationKey: 'common.preferences',
                icon: expensifyIcons.Gear,
                action: () => Navigation.navigate(ROUTES.SETTINGS_PREFERENCES),
            });
        }

        accountItems.push({
            translationKey: 'delegate.copilot',
            icon: expensifyIcons.Users,
            action: () => Navigation.navigate(ROUTES.SETTINGS_COPILOT),
        });

        if (!isAgentAccount) {
            accountItems.push({
                translationKey: 'initialSettingsPage.security',
                icon: expensifyIcons.Lock,
                action: () => Navigation.navigate(ROUTES.SETTINGS_SECURITY),
            });
        }

        const generalItems: Array<{translationKey: TranslationPaths; icon: IconAsset; action: () => void}> = [
            {
                translationKey: 'initialSettingsPage.help',
                icon: expensifyIcons.QuestionMark,
                action: () => Navigation.navigate(ROUTES.SETTINGS_HELP),
            },
            {
                translationKey: 'initialSettingsPage.about',
                icon: expensifyIcons.Info,
                action: () => Navigation.navigate(ROUTES.SETTINGS_ABOUT),
            },
            {
                translationKey: 'initialSettingsPage.aboutPage.troubleshoot',
                icon: expensifyIcons.Lightbulb,
                action: () => Navigation.navigate(ROUTES.SETTINGS_TROUBLESHOOT),
            },
        ];

        const menuItems = [...accountItems, ...generalItems].filter((item) => !ACCOUNT_MENU_EXCLUDED_TRANSLATION_KEYS.includes(item.translationKey));

        return menuItems.map((item) => ({
            keyForList: `navigation-account-${item.translationKey}`,
            translationKey: item.translationKey,
            navigationAction: item.action,
            navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.ACCOUNT,
            parentTabTitle: accountTabTitle,
            parentTabIcon: expensifyIcons.Profile,
            singleIcon: item.icon,
        }));
    }, [accountTabTitle, amountOwed, expensifyIcons, isAgentAccount, isBetaEnabled, subscriptionPlan]);

    const activePolicyIDForTravel = activePolicy?.id;
    const isActivePolicyTravelEnabled = activePolicy?.isTravelEnabled;

    return useMemo(() => {
        const suggestions: Array<NavigationSuggestionSource & {translate: typeof translate}> = [
            {
                keyForList: 'navigation-top-level-inbox',
                translationKey: 'common.inbox',
                keywords: ['chat'],
                navigationAction: navigateToInbox,
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.TOP_LEVEL,
                singleIcon: expensifyIcons.Inbox,
                translate,
            },
            {
                keyForList: 'navigation-top-level-account',
                translationKey: 'initialSettingsPage.account',
                keywords: ['settings'],
                navigationAction: navigateToAccount,
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.TOP_LEVEL,
                singleIcon: expensifyIcons.Profile,
                translate,
            },
            {
                keyForList: 'navigation-top-level-home',
                translationKey: 'common.home',
                navigationAction: () => Navigation.navigate(ROUTES.HOME),
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.TOP_LEVEL,
                singleIcon: expensifyIcons.Home,
                translate,
            },
            {
                keyForList: 'navigation-top-level-spend',
                translationKey: 'common.spend',
                keywords: ['expenses', 'search'],
                navigationAction: navigateToSpend,
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.TOP_LEVEL,
                singleIcon: expensifyIcons.ReceiptMultiple,
                translate,
            },
            {
                keyForList: 'navigation-top-level-workspaces',
                translationKey: 'common.workspacesTabTitle',
                keywords: ['workspace'],
                navigationAction: () => interceptAnonymousUser(navigateToWorkspaces),
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.TOP_LEVEL,
                singleIcon: expensifyIcons.Buildings,
                translate,
            },
            ...accountMenuSuggestions.map((suggestion) => ({...suggestion, translate})),
        ];

        for (const section of typeMenuSections) {
            for (const item of section.menuItems) {
                const spendIcon = expensifyIcons[item.icon];
                if (!spendIcon) {
                    continue;
                }

                suggestions.push({
                    keyForList: `navigation-spend-${item.key}`,
                    translationKey: item.translationPath,
                    navigationAction: () => {
                        setSearchContext(true);
                        Navigation.navigate(ROUTES.SEARCH_ROOT.getRoute({query: item.searchQuery}));
                    },
                    navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.SPEND,
                    parentTabTitle: spendTabTitle,
                    parentTabIcon: expensifyIcons.ReceiptMultiple,
                    singleIcon: spendIcon,
                    translate,
                });
            }
        }

        for (const policy of Object.values(allPolicies ?? {})) {
            if (!shouldShowPolicy(policy, false, sessionEmail)) {
                continue;
            }

            suggestions.push(
                ...buildWorkspaceSearchRouterNavigationItems({
                    policy,
                    currentUserLogin: sessionEmail ?? '',
                    icons: workspaceIcons,
                    isBetaEnabled,
                    onNavigate,
                }).map((suggestion) => ({...suggestion, translate})),
            );
        }

        const createMenuSuggestions: NavigationSuggestionSource[] = [
            {
                keyForList: 'navigation-create-expense',
                translationKey: 'iou.createExpense',
                navigationAction: () =>
                    interceptAnonymousUser(() => {
                        startMoneyRequest(CONST.IOU.TYPE.CREATE, createMenuReportID, draftTransactionIDs, undefined, undefined, undefined, true);
                    }),
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE,
                singleIcon: getIconForAction(CONST.IOU.TYPE.CREATE, {
                    Coins: expensifyIcons.Coins,
                    Receipt: expensifyIcons.Receipt,
                    Cash: expensifyIcons.Cash,
                    Transfer: expensifyIcons.Transfer,
                    MoneyCircle: expensifyIcons.MoneyCircle,
                }),
            },
            {
                keyForList: 'navigation-create-track-distance',
                translationKey: 'iou.trackDistance',
                navigationAction: () =>
                    interceptAnonymousUser(() => {
                        startDistanceRequest(CONST.IOU.TYPE.CREATE, createMenuReportID, draftTransactionIDs, lastDistanceExpenseType, undefined, undefined, true);
                    }),
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE,
                singleIcon: expensifyIcons.Location,
            },
        ];

        if (isCreateReportVisible) {
            createMenuSuggestions.push({
                keyForList: 'navigation-create-report',
                translationKey: 'report.newReport.createReport',
                navigationAction: () => interceptAnonymousUser(createReport),
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE,
                singleIcon: expensifyIcons.Document,
            });
        }

        createMenuSuggestions.push({
            keyForList: 'navigation-create-chat',
            translationKey: 'sidebarScreen.fabNewChat',
            navigationAction: () => interceptAnonymousUser(startNewChat),
            navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE,
            singleIcon: expensifyIcons.ChatBubble,
        });

        if (canSendInvoice) {
            createMenuSuggestions.push({
                keyForList: 'navigation-create-invoice',
                translationKey: 'workspace.invoices.sendInvoice',
                navigationAction: () =>
                    interceptAnonymousUser(() => {
                        startMoneyRequest(CONST.IOU.TYPE.INVOICE, createMenuReportID, draftTransactionIDs, undefined, undefined, undefined, true);
                    }),
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE,
                singleIcon: expensifyIcons.InvoiceGeneric,
            });
        }

        if (isActivePolicyTravelEnabled) {
            createMenuSuggestions.push({
                keyForList: 'navigation-create-travel',
                translationKey: 'travel.bookTravel',
                navigationAction: () =>
                    interceptAnonymousUser(() => {
                        if (isTravelEnabled) {
                            openTravelDotLink(activePolicyIDForTravel);
                            return;
                        }
                        Navigation.navigate(ROUTES.TRAVEL_MY_TRIPS.getRoute(activePolicyIDForTravel));
                    }),
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE,
                singleIcon: expensifyIcons.Suitcase,
                shouldIconApplyFill: !(isTravelEnabled && shouldOpenTravelDotLinkWeb()),
            });
        }

        if (!isLoadingApp && shouldShowNewWorkspaceButton) {
            createMenuSuggestions.push({
                keyForList: 'navigation-create-workspace',
                translationKey: 'workspace.new.newWorkspace',
                navigationAction: () => interceptAnonymousUser(() => Navigation.navigate(ROUTES.WORKSPACE_CONFIRMATION.getRoute(Navigation.getActiveRoute()))),
                navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE,
                singleIcon: expensifyIcons.NewWorkspace,
                shouldIconApplyFill: false,
            });
        }

        suggestions.push(...createMenuSuggestions.map((suggestion) => ({...suggestion, translate})));

        return filterNavigationSuggestions(suggestions, query);
    }, [
        accountMenuSuggestions,
        activePolicyIDForTravel,
        isActivePolicyTravelEnabled,
        allPolicies,
        canSendInvoice,
        createMenuReportID,
        createReport,
        draftTransactionIDs,
        expensifyIcons,
        isBetaEnabled,
        isCreateReportVisible,
        isLoadingApp,
        isTravelEnabled,
        lastDistanceExpenseType,
        navigateToAccount,
        navigateToInbox,
        navigateToSpend,
        navigateToWorkspaces,
        onNavigate,
        query,
        sessionEmail,
        shouldShowNewWorkspaceButton,
        spendTabTitle,
        translate,
        typeMenuSections,
        workspaceIcons,
    ]);
}

export default useSearchRouterNavigationSuggestions;
