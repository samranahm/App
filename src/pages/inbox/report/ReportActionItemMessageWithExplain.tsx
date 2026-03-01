import React from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import Icon from '@components/Icon';
import RenderHTML from '@components/RenderHTML';
import TextBlock from '@components/TextBlock';
import TextLinkBlock from '@components/TextLinkBlock';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useEnvironment from '@hooks/useEnvironment';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {openLink} from '@libs/actions/Link';
import {explain} from '@libs/actions/Report';
import {hasReasoning} from '@libs/ReportActionsUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import type {Report, ReportAction} from '@src/types/onyx';
import ReportActionItemBasicMessage from './ReportActionItemBasicMessage';

type ReportActionItemMessageWithExplainProps = {
    /** The message to display */
    message: string;

    /** All the data of the action item */
    action: OnyxEntry<ReportAction>;

    /** The child report of the action item */
    childReport: OnyxEntry<Report>;

    /** Original report from which the given reportAction is first created */
    originalReport: OnyxEntry<Report>;

    /** Whether the report was submitted via delay submissions */
    wasSubmittedViaHarvesting?: boolean;
};

/**
 * Wrapper component that renders a message and automatically appends the "Explain" link
 * if the action has reasoning.
 */
function ReportActionItemMessageWithExplain({message, action, childReport, originalReport, wasSubmittedViaHarvesting = false}: ReportActionItemMessageWithExplainProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const personalDetail = useCurrentUserPersonalDetails();
    const icons = useMemoizedLazyExpensifyIcons(['Sparkles']);
    const {environmentURL} = useEnvironment();

    const actionHasReasoning = hasReasoning(action);

    if (!actionHasReasoning) {
        return (
            <ReportActionItemBasicMessage>
                <RenderHTML
                    html={`<comment><muted-text>${message}</muted-text></comment>`}
                    onLinkPress={(event, href) => {
                        openLink(href, environmentURL);
                    }}
                />
            </ReportActionItemBasicMessage>
        );
    }

    const explainAndIconBlock = (
        <View style={[styles.flexRow, styles.alignItemsCenter]}>
            <TextLinkBlock
                onPress={() => explain(childReport, originalReport, action, translate, personalDetail.accountID, personalDetail?.timezone)}
                style={[styles.chatItemMessage, styles.link, styles.mrHalf]}
                text={translate('common.explain')}
            />
            <Icon
                src={icons.Sparkles}
                width={variables.iconSizeExtraSmall}
                height={variables.iconSizeExtraSmall}
                fill={theme.link}
            />
        </View>
    );

    if (wasSubmittedViaHarvesting) {
        // Split the translated string into inline parts to support languages with different word order
        const messageSplitByAnchor = message.match(CONST.REGEX_ANCHOR_WITH_TEXT);
        const messagePrefix = messageSplitByAnchor ? (messageSplitByAnchor.at(1) ?? '') : message;
        const anchorHref = messageSplitByAnchor ? (messageSplitByAnchor.at(2) ?? '') : '';
        const anchorLabel = messageSplitByAnchor ? (messageSplitByAnchor.at(3) ?? '') : '';
        const messageSuffix = messageSplitByAnchor ? (messageSplitByAnchor.at(4) ?? '') : '';

        return (
            <ReportActionItemBasicMessage>
                <View style={[styles.flexRow, styles.alignItemsCenter, styles.flexWrap]}>
                    {!!messagePrefix && (
                        <TextBlock
                            textStyles={[styles.chatItemMessage, styles.colorMuted]}
                            text={messagePrefix}
                        />
                    )}
                    {!!anchorLabel && (
                        <TextLinkBlock
                            onPress={() => openLink(anchorHref, environmentURL)}
                            style={[styles.chatItemMessage, styles.link]}
                            text={anchorLabel}
                        />
                    )}
                    <TextBlock
                        textStyles={[styles.chatItemMessage, styles.colorMuted]}
                        text={`${messageSuffix}. `}
                    />
                    {explainAndIconBlock}
                </View>
            </ReportActionItemBasicMessage>
        );
    }

    return (
        <ReportActionItemBasicMessage>
            <View style={[styles.flexRow, styles.alignItemsCenter, styles.flexWrap]}>
                <TextBlock
                    textStyles={[styles.chatItemMessage, styles.colorMuted]}
                    text={`${message}. `}
                />
                {explainAndIconBlock}
            </View>
        </ReportActionItemBasicMessage>
    );
}

ReportActionItemMessageWithExplain.displayName = 'ReportActionItemMessageWithExplain';

export default ReportActionItemMessageWithExplain;
