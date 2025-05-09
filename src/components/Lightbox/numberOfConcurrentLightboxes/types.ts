// Increase/decrease this number to change the number of concurrent lightboxes
// The more concurrent lightboxes, the worse performance gets (especially on low-end devices)
type LightboxConcurrencyLimit = number | 'UNLIMITED';

export default LightboxConcurrencyLimit;
