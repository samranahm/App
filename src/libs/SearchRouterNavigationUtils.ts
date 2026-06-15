import type {ValueOf} from 'type-fest';
import type {LocaleContextProps} from '@components/LocaleContextProvider';
import type {SearchQueryItem} from '@components/Search/SearchList/ListItem/SearchQueryListItem';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type {AvatarType} from '@src/types/onyx/OnyxCommon';
import type IconAsset from '@src/types/utils/IconAsset';
import type {AvatarSource} from './UserAvatarUtils';

type SearchRouterNavigationContext = ValueOf<typeof CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT>;

type NavigationSuggestionWorkspaceAvatar = {
    source: AvatarSource;
    name: string;
    type: AvatarType;
    id?: string;
};

type NavigationSuggestionSource = {
    keyForList: string;
    translationKey?: TranslationPaths;
    title?: string;
    keywords?: string[];
    navigationAction: () => void;
    navigationContextType: SearchRouterNavigationContext;
    parentTabTitle?: string;
    parentTabIcon?: IconAsset;
    workspaceAvatar?: NavigationSuggestionWorkspaceAvatar;
    workspaceName?: string;
    singleIcon: IconAsset;
    shouldIconApplyFill?: boolean;
};

const ACCOUNT_MENU_EXCLUDED_TRANSLATION_KEYS: TranslationPaths[] = [
    'initialSettingsPage.whatIsNew',
    'initialSettingsPage.signOut',
    'initialSettingsPage.restoreStashed',
    'sidebarScreen.saveTheWorld',
];

const NAVIGATION_CONTEXT_SORT_ORDER: Record<SearchRouterNavigationContext, number> = {
    [CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.TOP_LEVEL]: 0,
    [CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.ACCOUNT]: 1,
    [CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.SPEND]: 2,
    [CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.WORKSPACE]: 3,
    [CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE]: 4,
};

/* eslint-disable @typescript-eslint/naming-convention -- keyForList values used for sort order */
const TOP_LEVEL_SORT_ORDER: Record<string, number> = {
    'navigation-top-level-home': 0,
    'navigation-top-level-inbox': 1,
    'navigation-top-level-spend': 2,
    'navigation-top-level-workspaces': 3,
    'navigation-top-level-account': 4,
};
/* eslint-enable @typescript-eslint/naming-convention */

function normalizeNavigationQuery(query: string): string {
    return query.trim().toLowerCase();
}

function doesNavigationSuggestionMatch(query: string, label: string, keywords: string[] = [], displayText?: string): boolean {
    const normalizedQuery = normalizeNavigationQuery(query);
    if (normalizedQuery.length <= CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_MIN_QUERY_LENGTH) {
        return false;
    }

    const searchableValues = [label, ...(displayText ? [displayText] : []), ...keywords].map((value) => value.toLowerCase());
    return searchableValues.some((value) => value.includes(normalizedQuery));
}

function getNavigationSuggestionSortOrder(suggestion: NavigationSuggestionSource): number {
    const contextOrder = NAVIGATION_CONTEXT_SORT_ORDER[suggestion.navigationContextType] ?? Number.MAX_SAFE_INTEGER;

    if (suggestion.navigationContextType === CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.TOP_LEVEL) {
        return contextOrder * 1000 + (TOP_LEVEL_SORT_ORDER[suggestion.keyForList] ?? Number.MAX_SAFE_INTEGER);
    }

    return contextOrder * 1000;
}

function buildNavigationSuggestion({
    keyForList,
    translationKey,
    title,
    navigationAction,
    navigationContextType,
    parentTabTitle,
    parentTabIcon,
    workspaceAvatar,
    workspaceName,
    singleIcon,
    shouldIconApplyFill,
    translate,
}: NavigationSuggestionSource & {translate: LocaleContextProps['translate']}): SearchQueryItem {
    const destinationTitle = title ?? (translationKey ? translate(translationKey) : '');
    const isCreateSuggestion = navigationContextType === CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE;

    return {
        keyForList,
        text: isCreateSuggestion ? destinationTitle : translate('search.goTo', destinationTitle),
        navigationAction,
        navigationContextType,
        parentTabTitle,
        parentTabIcon,
        workspaceAvatar,
        workspaceName,
        singleIcon,
        shouldIconApplyFill,
        searchItemType: CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATION_SUGGESTION,
    };
}

function filterNavigationSuggestions(suggestions: Array<NavigationSuggestionSource & {translate: LocaleContextProps['translate']}>, query: string): SearchQueryItem[] {
    const normalizedQuery = normalizeNavigationQuery(query);
    if (normalizedQuery.length <= CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_MIN_QUERY_LENGTH) {
        return [];
    }

    return suggestions
        .filter((suggestion) => {
            const label = suggestion.title ?? (suggestion.translationKey ? suggestion.translate(suggestion.translationKey) : '');
            const isCreateSuggestion = suggestion.navigationContextType === CONST.SEARCH.SEARCH_ROUTER_NAVIGATION_CONTEXT.CREATE;
            const displayText = isCreateSuggestion ? label : suggestion.translate('search.goTo', label);
            return doesNavigationSuggestionMatch(normalizedQuery, label, suggestion.keywords ?? [], displayText);
        })
        .sort((firstSuggestion, secondSuggestion) => getNavigationSuggestionSortOrder(firstSuggestion) - getNavigationSuggestionSortOrder(secondSuggestion))
        .map((suggestion) => buildNavigationSuggestion(suggestion));
}

export {ACCOUNT_MENU_EXCLUDED_TRANSLATION_KEYS, buildNavigationSuggestion, doesNavigationSuggestionMatch, filterNavigationSuggestions, normalizeNavigationQuery};
export type {NavigationSuggestionSource, NavigationSuggestionWorkspaceAvatar, SearchRouterNavigationContext};
