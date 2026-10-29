import {renderHook} from '@testing-library/react-native';

import Navigation from '@navigation/Navigation';

import useConnectedAccountingIntegration from '@pages/workspace/accounting/useConnectedAccountingIntegration';

import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {Policy} from '@src/types/onyx';
import type {ConnectionName} from '@src/types/onyx/Policy';

import type {GestureResponderEvent} from 'react-native';

import createRandomPolicy from '../utils/collections/policies';
import createMock from '../utils/createMock';

const mockSyncConnection = jest.fn();
let mockConnectedIntegration: ConnectionName | undefined;
let mockSynchronizationError: string | undefined;
let mockIsAuthenticationError = false;

jest.mock('@hooks/useCardFeeds', () => () => [undefined]);
jest.mock('@hooks/useCardsLists', () => () => [undefined]);
jest.mock('@hooks/useConfirmModal', () => () => ({showConfirmModal: jest.fn()}));
jest.mock('@hooks/useEnvironment', () => () => ({environment: 'development'}));
jest.mock('@hooks/useExpensifyCardFeeds', () => () => ({}));
jest.mock('@hooks/useHasReusablePoliciesConnectedTo', () => () => false);
jest.mock('@hooks/useIsUnifiedConnectionsBetaEnabled', () => () => false);
jest.mock('@hooks/useLazyAsset', () => ({useMemoizedLazyExpensifyIcons: () => ({})}));
jest.mock('@hooks/useLocalize', () => () => ({
    translate: (key: string) => key,
    datetimeToRelative: () => '',
    getLocalDateFromDatetime: jest.fn(),
    dateFnsLocale: undefined,
}));
jest.mock('@hooks/useNetwork', () => () => ({isOffline: false}));
jest.mock('@hooks/useOnyx', () => () => [undefined]);
jest.mock('@hooks/usePermissions', () => () => ({isBetaEnabled: () => false}));
jest.mock('@hooks/usePolicyFeatureWriteAccess', () => () => ({canWrite: true, showReadOnlyModal: jest.fn()}));
jest.mock('@hooks/useThemeStyles', () => () => ({}));
jest.mock('@hooks/useWorkspaceAccountID', () => () => undefined);
jest.mock('@libs/AccountingUtils', () => ({
    getQBORefreshTokenExpiryDate: () => undefined,
    getQBORefreshTokenExpiryStatus: () => undefined,
}));
jest.mock('@libs/actions/connections', () => ({
    isAuthenticationError: () => mockIsAuthenticationError,
    isConnectionInProgress: () => false,
    isConnectionUnverified: () => false,
    removePolicyConnection: jest.fn(),
    // Lazy wrapper so mockSyncConnection is resolved at call time
    syncConnection: (...args: unknown[]) => {
        mockSyncConnection(...args);
    },
}));
jest.mock('@libs/CardUtils', () => ({isExpensifyCardFullySetUp: () => false}));
jest.mock('@libs/DateUtils', () => ({formatWithUTCTimeZone: jest.fn()}));
jest.mock('@libs/Environment/Environment', () => ({
    getEnvironmentURL: () => Promise.resolve(''),
    getOldDotURLFromEnvironment: () => '',
}));
jest.mock('@components/TextLink', () => ({__esModule: true, default: () => null}));
jest.mock('@libs/PolicyUtils', () => ({
    areSettingsInErrorFields: () => false,
    findCurrentXeroOrganization: () => undefined,
    getConnectedIntegration: () => mockConnectedIntegration,
    getCurrentSageIntacctEntityName: () => '',
    getCurrentXeroOrganizationName: () => '',
    getIntegrationLastSuccessfulDate: () => undefined,
    getXeroTenants: () => [],
    hasAccountingConnections: () => true,
    hasSupportedOnlyOnOldDotIntegration: () => false,
    settingsPendingAction: () => undefined,
    shouldShowQBOReimbursableExportDestinationAccountError: () => false,
    shouldShowSyncError: () => false,
}));
jest.mock('@navigation/Navigation', () => ({__esModule: true, default: {navigate: jest.fn()}}));
jest.mock('@userActions/Policy/Policy', () => ({openPolicyExpensifyCardsPage: jest.fn()}));
jest.mock('@pages/workspace/accounting/AccountingContext', () => ({
    useAccountingActions: () => ({startIntegrationFlow: jest.fn()}),
    useAccountingState: () => ({activeIntegration: undefined}),
}));
jest.mock('@pages/workspace/accounting/certinia/utils', () => ({
    getCertiniaSelectedCompanyID: () => undefined,
    isCertiniaFFAConnection: () => false,
}));
jest.mock('@pages/workspace/accounting/utils', () => ({
    getAccountingIntegrationData: () => undefined,
    getAccountingIntegrationDisplayName: () => '',
    getSynchronizationErrorMessage: () => mockSynchronizationError,
    isIntuitEnterpriseSuiteConnection: () => false,
}));

const policy: Policy = {...createRandomPolicy(1, CONST.POLICY.TYPE.CORPORATE), id: 'policy-1'};

const zohoBooksPolicy: Policy = {
    ...policy,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The hook only reads the entity list and the selected entity, so the rest of the connection config is left out.
    connections: {
        [CONST.POLICY.CONNECTIONS.NAME.ZOHO_BOOKS]: {
            config: {subsidiaryID: 'org-1'},
            data: {
                organizations: [
                    {id: 'org-1', name: 'Organization One', currency: 'USD'},
                    {id: 'org-2', name: 'Organization Two', currency: 'USD'},
                ],
            },
        },
    } as Policy['connections'],
};

const campfirePolicy: Policy = {
    ...policy,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The hook only reads the entity list and the selected entity, so the rest of the connection config is left out.
    connections: {
        [CONST.POLICY.CONNECTIONS.NAME.CAMPFIRE]: {
            config: {subsidiaryID: 'subsidiary-1'},
            data: {
                subsidiaries: [
                    {id: 'subsidiary-1', name: 'Subsidiary One', currency: 'USD'},
                    {id: 'subsidiary-2', name: 'Subsidiary Two', currency: 'USD'},
                ],
            },
        },
    } as Policy['connections'],
};

function getSettingsMenuItems(policyToRender: Policy) {
    const {result} = renderHook(() => useConnectedAccountingIntegration(policyToRender));
    return result.current.connectionDetails?.settingsMenuItems ?? [];
}

function getSettingsMenuItemDescriptions(policyToRender: Policy) {
    return getSettingsMenuItems(policyToRender).map((item) => item.description);
}

function createNetSuitePolicy(subsidiary: string, subsidiaryList: Array<{internalID: string; name: string}>): Policy {
    return {
        ...policy,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The hook only reads the selected subsidiary and the subsidiary list, so the rest of the connection config is left out.
        connections: {
            [CONST.POLICY.CONNECTIONS.NAME.NETSUITE]: {
                options: {config: {subsidiary}, data: {subsidiaryList}},
            },
        } as Policy['connections'],
    };
}

const twoSubsidiaries = [
    {internalID: '1', name: 'Honeycomb Mfg.'},
    {internalID: '3', name: 'Honeycomb Holdings Inc.'},
];

function getSyncNowItem() {
    const {result} = renderHook(() => useConnectedAccountingIntegration(policy));
    return result.current.overflowMenu.find((item) => item.text === 'workspace.accounting.syncNow');
}

describe('useConnectedAccountingIntegration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnectedIntegration = undefined;
        mockSynchronizationError = undefined;
        mockIsAuthenticationError = false;
    });

    describe('Sync now menu item', () => {
        it('should call syncConnection with forceDataRefresh true when connected to QBD', () => {
            // Given a workspace connected to QuickBooks Desktop
            mockConnectedIntegration = CONST.POLICY.CONNECTIONS.NAME.QBD;

            // When the user selects "Sync now"
            getSyncNowItem()?.onSelected?.();

            // Then syncConnection is called with forceDataRefresh true so IS forces a full data refresh from Codat
            expect(mockSyncConnection).toHaveBeenCalledWith(policy, CONST.POLICY.CONNECTIONS.NAME.QBD, true);
        });

        it('should call syncConnection with forceDataRefresh false for non-QBD integrations', () => {
            // Given a workspace connected to QuickBooks Online
            mockConnectedIntegration = CONST.POLICY.CONNECTIONS.NAME.QBO;

            // When the user selects "Sync now"
            getSyncNowItem()?.onSelected?.();

            // Then syncConnection is called with forceDataRefresh false since only QBD uses Codat's cached data
            expect(mockSyncConnection).toHaveBeenCalledWith(policy, CONST.POLICY.CONNECTIONS.NAME.QBO, false);
        });
    });

    describe('Integration-specific settings row on a failed sync', () => {
        it('should keep the Zoho Books organization row when the last sync failed', () => {
            // Given a workspace connected to Zoho Books with two organizations whose last sync failed
            mockConnectedIntegration = CONST.POLICY.CONNECTIONS.NAME.ZOHO_BOOKS;
            mockSynchronizationError = 'Sync failed';

            // When the connected integration's settings rows are built
            const descriptions = getSettingsMenuItemDescriptions(zohoBooksPolicy);

            // Then the organization row is still shown, because the selected organization can be what broke the sync and admins need the row to switch it
            expect(descriptions).toContain('workspace.zohoBooks.organization');
        });

        it('should keep the integration-specific row for other connectors when the last sync failed for a reason other than authentication', () => {
            // Given a workspace connected to Campfire with two entities whose last sync failed
            mockConnectedIntegration = CONST.POLICY.CONNECTIONS.NAME.CAMPFIRE;
            mockSynchronizationError = 'Sync failed';

            // When the connected integration's settings rows are built
            const descriptions = getSettingsMenuItemDescriptions(campfirePolicy);

            // Then the entity row is still shown, because the selected entity can be what broke the sync
            expect(descriptions).toContain('workspace.campfire.entity');
        });

        it('should drop the integration-specific row when the last sync failed with an authentication error', () => {
            // Given a workspace connected to Campfire whose last sync failed because the credentials are invalid
            mockConnectedIntegration = CONST.POLICY.CONNECTIONS.NAME.CAMPFIRE;
            mockSynchronizationError = 'Authentication error';
            mockIsAuthenticationError = true;

            // When the connected integration's settings rows are built
            const descriptions = getSettingsMenuItemDescriptions(campfirePolicy);

            // Then the entity row is hidden, since the admin has to fix the credentials before changing the entity
            expect(descriptions).not.toContain('workspace.campfire.entity');
        });
    });

    describe('NetSuite subsidiary row on a failed sync', () => {
        beforeEach(() => {
            mockConnectedIntegration = CONST.POLICY.CONNECTIONS.NAME.NETSUITE;
        });

        it('should keep the subsidiary row and let the admin open the selector when the last sync failed for a reason other than authentication', () => {
            // Given a NetSuite workspace with a selected subsidiary whose last sync failed
            mockSynchronizationError = 'Sync failed';
            const netSuitePolicy = createNetSuitePolicy('Honeycomb Mfg.', twoSubsidiaries);

            // When the settings rows are built
            const subsidiaryItem = getSettingsMenuItems(netSuitePolicy).find((item) => item.description === 'workspace.netsuite.subsidiary');
            subsidiaryItem?.onPress?.(createMock<GestureResponderEvent>({}));

            // Then the row is shown with the selected subsidiary and opens the selector so the admin can switch it
            expect(subsidiaryItem?.title).toBe('Honeycomb Mfg.');
            expect(Navigation.navigate).toHaveBeenCalledWith(ROUTES.POLICY_ACCOUNTING_NETSUITE_SUBSIDIARY_SELECTOR.getRoute('policy-1'));
        });

        it('should hide the subsidiary row when the last sync failed with an authentication error', () => {
            // Given a NetSuite workspace whose last sync failed because the credentials are invalid
            mockSynchronizationError = 'Authentication error';
            mockIsAuthenticationError = true;

            // When the settings rows are built
            const descriptions = getSettingsMenuItemDescriptions(createNetSuitePolicy('Honeycomb Mfg.', twoSubsidiaries));

            // Then the subsidiary row is hidden, since the admin has to fix the credentials first
            expect(descriptions).not.toContain('workspace.netsuite.subsidiary');
        });

        it('should show a selectable subsidiary row when the last sync failed and no subsidiary is selected', () => {
            // Given a NetSuite workspace with no selected subsidiary whose last sync failed, which is what the "select an existing subsidiary" error describes
            mockSynchronizationError = 'Sync failed';
            const netSuitePolicy = createNetSuitePolicy('', twoSubsidiaries);

            // When the settings rows are built
            const subsidiaryItem = getSettingsMenuItems(netSuitePolicy).find((item) => item.description === 'workspace.netsuite.subsidiary');
            subsidiaryItem?.onPress?.(createMock<GestureResponderEvent>({}));

            // Then the admin gets a row that opens the selector, as it is their only way to pick a subsidiary
            expect(subsidiaryItem?.title).toBe('common.select');
            expect(subsidiaryItem?.shouldShowRightIcon).toBe(true);
            expect(Navigation.navigate).toHaveBeenCalledWith(ROUTES.POLICY_ACCOUNTING_NETSUITE_SUBSIDIARY_SELECTOR.getRoute('policy-1'));
        });

        it('should keep hiding the empty subsidiary row when there is no sync error', () => {
            // Given a NetSuite workspace that is syncing for the first time, so no subsidiary is selected and there is no error yet
            const descriptions = getSettingsMenuItemDescriptions(createNetSuitePolicy('', twoSubsidiaries));

            // When the settings rows are built

            // Then no empty subsidiary row is shown
            expect(descriptions).not.toContain('workspace.netsuite.subsidiary');
        });

        it('should keep hiding the subsidiary row when the last sync failed, no subsidiary is selected and there is nothing to choose from', () => {
            // Given a NetSuite workspace whose failed sync did not bring in any subsidiaries
            mockSynchronizationError = 'Sync failed';

            // When the settings rows are built
            const descriptions = getSettingsMenuItemDescriptions(createNetSuitePolicy('', []));

            // Then the row is hidden, since the selector would only show an empty list
            expect(descriptions).not.toContain('workspace.netsuite.subsidiary');
        });
    });
});
