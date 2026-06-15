import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import type Policy from '@src/types/onyx/Policy';
import type {PolicyFeatureName} from '@src/types/onyx/Policy';
import type IconAsset from '@src/types/utils/IconAsset';
import {isAnyHRConnected} from './HRUtils';
import {canMemberRead, canPolicyAccessFeature, hasAccountingFeatureConnection, isGroupPolicy, isTimeTrackingEnabled} from './PolicyUtils';
import type {PolicyFeature} from './PolicyUtils';
import {getDefaultWorkspaceAvatar} from './ReportUtils';
import type {NavigationSuggestionSource, NavigationSuggestionWorkspaceAvatar} from './SearchRouterNavigationUtils';

type PolicyFeatureStates = Record<PolicyFeatureName, boolean>;

type WorkspaceNavigationIcons = Record<
    | 'Building'
    | 'CalendarSolid'
    | 'Car'
    | 'Coins'
    | 'CreditCard'
    | 'Document'
    | 'ExpensifyCard'
    | 'Feed'
    | 'Folder'
    | 'Gear'
    | 'Hashtag'
    | 'InvoiceGeneric'
    | 'Receipt'
    | 'Sync'
    | 'Tag'
    | 'Users'
    | 'Workflows'
    | 'LuggageWithLines'
    | 'Clock',
    IconAsset
>;

type WorkspaceNavigationFeatureConfig = {
    translationKey: TranslationPaths;
    icon: keyof WorkspaceNavigationIcons;
    getFeatureRoute: (policyID: string) => Route;
    isFeatureAvailable: (policyFeatureStates: PolicyFeatureStates) => boolean;
    canShow: (params: {
        policy: OnyxEntry<Policy>;
        policyFeatureStates: PolicyFeatureStates;
        canReadPolicyFeature: (policyFeature: PolicyFeature) => boolean;
        canReadMoreFeatures: boolean;
        isBetaEnabled: (beta: ValueOf<typeof CONST.BETAS>) => boolean;
    }) => boolean;
};

function getPolicyFeatureStates(policy: OnyxEntry<Policy>): PolicyFeatureStates {
    return {
        [CONST.POLICY.MORE_FEATURES.ARE_DISTANCE_RATES_ENABLED]: !!policy?.areDistanceRatesEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_WORKFLOWS_ENABLED]: !!policy?.areWorkflowsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_CATEGORIES_ENABLED]: !!policy?.areCategoriesEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED]: !!policy?.areTagsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_TAXES_ENABLED]: !!policy?.tax?.trackingEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_COMPANY_CARDS_ENABLED]: !!policy?.areCompanyCardsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_CONNECTIONS_ENABLED]: !!policy?.areConnectionsEnabled || hasAccountingFeatureConnection(policy),
        [CONST.POLICY.MORE_FEATURES.IS_HR_ENABLED]: (policy?.isHREnabled === true || isAnyHRConnected(policy)) && canPolicyAccessFeature(policy, CONST.POLICY.MORE_FEATURES.IS_HR_ENABLED),
        [CONST.POLICY.MORE_FEATURES.ARE_EXPENSIFY_CARDS_ENABLED]: !!policy?.areExpensifyCardsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_REPORT_FIELDS_ENABLED]: !!policy?.areReportFieldsEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_RULES_ENABLED]: !!policy?.areRulesEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_INVOICES_ENABLED]: !!policy?.areInvoicesEnabled,
        [CONST.POLICY.MORE_FEATURES.ARE_PER_DIEM_RATES_ENABLED]: !!policy?.arePerDiemRatesEnabled && canPolicyAccessFeature(policy, CONST.POLICY.MORE_FEATURES.ARE_PER_DIEM_RATES_ENABLED),
        [CONST.POLICY.MORE_FEATURES.ARE_RECEIPT_PARTNERS_ENABLED]: !!policy?.receiptPartners?.enabled,
        [CONST.POLICY.MORE_FEATURES.IS_TRAVEL_ENABLED]: !!policy?.isTravelEnabled,
        [CONST.POLICY.MORE_FEATURES.IS_TIME_TRACKING_ENABLED]: isTimeTrackingEnabled(policy),
        [CONST.POLICY.MORE_FEATURES.IS_ATTENDEE_TRACKING_ENABLED]: !!policy?.isAttendeeTrackingEnabled,
        [CONST.POLICY.MORE_FEATURES.REQUIRE_COMPANY_CARDS_ENABLED]: !!policy?.requireCompanyCardsEnabled,
    };
}

const WORKSPACE_NAVIGATION_FEATURES: WorkspaceNavigationFeatureConfig[] = [
    {
        translationKey: 'workspace.common.profile',
        icon: 'Building',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_OVERVIEW.getRoute(policyID),
        isFeatureAvailable: () => true,
        canShow: () => true,
    },
    {
        translationKey: 'workspace.common.members',
        icon: 'Users',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_MEMBERS.getRoute(policyID),
        isFeatureAvailable: () => true,
        canShow: () => true,
    },
    {
        translationKey: 'workspace.common.rooms',
        icon: 'Hashtag',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_ROOMS.getRoute(policyID),
        isFeatureAvailable: () => true,
        canShow: ({isBetaEnabled}) => isBetaEnabled(CONST.BETAS.WORKSPACE_ROOMS_PAGE),
    },
    {
        translationKey: 'common.reports',
        icon: 'Document',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_REPORTS.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_REPORT_FIELDS_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.REPORT_FIELDS),
    },
    {
        translationKey: 'workspace.common.accounting',
        icon: 'Sync',
        getFeatureRoute: (policyID) => ROUTES.POLICY_ACCOUNTING.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_CONNECTIONS_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.ACCOUNTING),
    },
    {
        translationKey: 'workspace.common.hr',
        icon: 'Users',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_HR.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.IS_HR_ENABLED],
        canShow: ({policy, canReadMoreFeatures}) => isGroupPolicy(policy) && canReadMoreFeatures,
    },
    {
        translationKey: 'workspace.common.receiptPartners',
        icon: 'Receipt',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_RECEIPT_PARTNERS.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_RECEIPT_PARTNERS_ENABLED],
        canShow: ({policy, canReadMoreFeatures}) => isGroupPolicy(policy) && canReadMoreFeatures,
    },
    {
        translationKey: 'workspace.common.categories',
        icon: 'Folder',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_CATEGORIES.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_CATEGORIES_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.CATEGORIES),
    },
    {
        translationKey: 'workspace.common.tags',
        icon: 'Tag',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_TAGS.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_TAGS_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.TAGS),
    },
    {
        translationKey: 'workspace.common.taxes',
        icon: 'Coins',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_TAXES.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_TAXES_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.TAXES),
    },
    {
        translationKey: 'workspace.common.workflows',
        icon: 'Workflows',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_WORKFLOWS.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_WORKFLOWS_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.WORKFLOWS),
    },
    {
        translationKey: 'workspace.common.rules',
        icon: 'Feed',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_RULES.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_RULES_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.RULES),
    },
    {
        translationKey: 'workspace.common.distanceRates',
        icon: 'Car',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_DISTANCE_RATES.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_DISTANCE_RATES_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.DISTANCE_RATES),
    },
    {
        translationKey: 'workspace.common.travel',
        icon: 'LuggageWithLines',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_TRAVEL.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.IS_TRAVEL_ENABLED],
        canShow: ({policy, canReadMoreFeatures}) => isGroupPolicy(policy) && canReadMoreFeatures,
    },
    {
        translationKey: 'workspace.common.expensifyCard',
        icon: 'ExpensifyCard',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_EXPENSIFY_CARD.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_EXPENSIFY_CARDS_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.EXPENSIFY_CARD),
    },
    {
        translationKey: 'workspace.common.companyCards',
        icon: 'CreditCard',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_COMPANY_CARDS.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_COMPANY_CARDS_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.COMPANY_CARDS),
    },
    {
        translationKey: 'common.perDiem',
        icon: 'CalendarSolid',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_PER_DIEM.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_PER_DIEM_RATES_ENABLED],
        canShow: ({policy, canReadPolicyFeature}) => isGroupPolicy(policy) && canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.PER_DIEM),
    },
    {
        translationKey: 'iou.time',
        icon: 'Clock',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_TIME_TRACKING.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.IS_TIME_TRACKING_ENABLED],
        canShow: ({policy, canReadMoreFeatures}) => isGroupPolicy(policy) && canReadMoreFeatures,
    },
    {
        translationKey: 'workspace.common.invoices',
        icon: 'InvoiceGeneric',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_INVOICES.getRoute(policyID),
        isFeatureAvailable: (policyFeatureStates) => !!policyFeatureStates[CONST.POLICY.MORE_FEATURES.ARE_INVOICES_ENABLED],
        canShow: ({policy, canReadMoreFeatures}) => isGroupPolicy(policy) && canReadMoreFeatures,
    },
    {
        translationKey: 'workspace.common.moreFeatures',
        icon: 'Gear',
        getFeatureRoute: (policyID) => ROUTES.WORKSPACE_MORE_FEATURES.getRoute(policyID),
        isFeatureAvailable: () => true,
        canShow: ({policy, canReadMoreFeatures}) => isGroupPolicy(policy) && canReadMoreFeatures,
    },
];

function getWorkspaceAvatar(policy: OnyxEntry<Policy>, fallbackIcon: IconAsset): NavigationSuggestionWorkspaceAvatar {
    if (!policy) {
        return {
            source: fallbackIcon,
            name: CONST.EXPENSIFY_ICON_NAME,
            type: CONST.ICON_TYPE_AVATAR,
        };
    }

    return {
        source: policy.avatarURL ? policy.avatarURL : getDefaultWorkspaceAvatar(policy.name),
        name: policy.name ?? '',
        type: CONST.ICON_TYPE_WORKSPACE,
        id: policy.id,
    };
}

function buildWorkspaceSearchRouterNavigationItems({
    policy,
    currentUserLogin,
    icons,
    isBetaEnabled,
    onNavigate,
}: {
    policy: OnyxEntry<Policy>;
    currentUserLogin: string;
    icons: WorkspaceNavigationIcons;
    isBetaEnabled: (beta: ValueOf<typeof CONST.BETAS>) => boolean;
    onNavigate: (route: Route) => void;
}): NavigationSuggestionSource[] {
    const policyID = policy?.id;
    if (!policyID) {
        return [];
    }

    const canReadPolicyFeature = (policyFeature: PolicyFeature) => canMemberRead(policy, currentUserLogin, policyFeature);
    const canReadMoreFeatures = canReadPolicyFeature(CONST.POLICY.POLICY_FEATURE.MORE_FEATURES);
    const policyFeatureStates = getPolicyFeatureStates(policy);
    const moreFeaturesRoute = ROUTES.WORKSPACE_MORE_FEATURES.getRoute(policyID);
    const workspaceAvatar = getWorkspaceAvatar(policy, icons.Building);
    const workspaceName = policy?.name ?? '';

    const navigateToFeatureOrMoreFeatures = (featureRoute: Route, isFeatureAvailable: boolean) => {
        onNavigate(isFeatureAvailable ? featureRoute : moreFeaturesRoute);
    };

    return WORKSPACE_NAVIGATION_FEATURES.filter((feature) =>
        feature.canShow({
            policy,
            policyFeatureStates,
            canReadPolicyFeature,
            canReadMoreFeatures,
            isBetaEnabled,
        }),
    ).map((feature) => {
        const featureRoute = feature.getFeatureRoute(policyID);
        const isFeatureAvailable = feature.isFeatureAvailable(policyFeatureStates);

        return {
            keyForList: `navigation-workspace-${policyID}-${feature.translationKey}`,
            translationKey: feature.translationKey,
            navigationAction: () => navigateToFeatureOrMoreFeatures(featureRoute, isFeatureAvailable),
            navigationContextType: CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.WORKSPACE,
            workspaceAvatar,
            workspaceName,
            singleIcon: icons[feature.icon],
        };
    });
}

export {buildWorkspaceSearchRouterNavigationItems, getWorkspaceAvatar};
export type {WorkspaceNavigationIcons};
