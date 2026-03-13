import { Platform } from 'react-native';

export function getTextInputAutofillProps(kind) {
    switch (kind) {
        case 'username':
            return Platform.select({
                ios: { textContentType: 'username' },
                android: { autoComplete: 'username' },
                default: {}
            });
        case 'email':
            return Platform.select({
                ios: { textContentType: 'emailAddress' },
                android: { autoComplete: 'email' },
                default: {}
            });
        case 'currentPassword':
            return Platform.select({
                ios: { textContentType: 'password' },
                android: { autoComplete: 'current-password' },
                default: {}
            });
        case 'newPassword':
            return Platform.select({
                ios: {
                    textContentType: 'newPassword',
                    passwordRules: 'minlength: 10; required: upper; required: lower; required: digit;'
                },
                android: { autoComplete: 'new-password' },
                default: {}
            });
        case 'name':
            return Platform.select({
                ios: { textContentType: 'name' },
                android: { autoComplete: 'name' },
                default: {}
            });
        case 'telephone':
            return Platform.select({
                ios: { textContentType: 'telephoneNumber' },
                android: { autoComplete: 'tel' },
                default: {}
            });
        case 'creditCardNumber':
            return Platform.select({
                ios: { textContentType: 'creditCardNumber' },
                android: { autoComplete: 'cc-number' },
                default: {}
            });
        case 'url':
            return Platform.select({
                ios: { textContentType: 'URL' },
                android: {},
                default: {}
            });
        default:
            return {};
    }
}
