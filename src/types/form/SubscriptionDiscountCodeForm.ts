import type Form from './Form';

const INPUT_IDS = {
    DISCOUNT_CODE: 'discountCode',
} as const;

type InputID = (typeof INPUT_IDS)[keyof typeof INPUT_IDS];

type SubscriptionDiscountCodeForm = Form<
    InputID,
    {
        [INPUT_IDS.DISCOUNT_CODE]: string;
    }
>;

export type {SubscriptionDiscountCodeForm};
export default INPUT_IDS;
