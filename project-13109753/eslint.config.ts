import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import routeElementPlugin from './eslint-rules/route-element-jsx.js'

const autoImportGlobals = {
  // React
  React: 'readonly',
  useState: 'readonly',
  useEffect: 'readonly',
  useContext: 'readonly',
  useReducer: 'readonly',
  useCallback: 'readonly',
  useMemo: 'readonly',
  useRef: 'readonly',
  useImperativeHandle: 'readonly',
  useLayoutEffect: 'readonly',
  useDebugValue: 'readonly',
  useDeferredValue: 'readonly',
  useId: 'readonly',
  useInsertionEffect: 'readonly',
  useSyncExternalStore: 'readonly',
  useTransition: 'readonly',
  startTransition: 'readonly',
  lazy: 'readonly',
  memo: 'readonly',
  forwardRef: 'readonly',
  createContext: 'readonly',
  createElement: 'readonly',
  cloneElement: 'readonly',
  isValidElement: 'readonly',
  // React Router
  useNavigate: 'readonly',
  useLocation: 'readonly',
  useParams: 'readonly',
  useSearchParams: 'readonly',
  Link: 'readonly',
  NavLink: 'readonly',
  Navigate: 'readonly',
  Outlet: 'readonly',
  // React i18n
  useTranslation: 'readonly',
  Trans: 'readonly',
}

export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...autoImportGlobals,
        NodeJS: 'readonly',
        JSX: 'readonly',
        IdleRequestCallback: 'readonly',
        __BASE_PATH__: 'readonly',
        __IS_PREVIEW__: 'readonly',
        __READDY_PROJECT_ID__: 'readonly',
        __READDY_VERSION_ID__: 'readonly',
        __READDY_AI_DOMAIN__: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'no-useless-escape': 'off',
      'prefer-const': 'off',
      'prefer-rest-params': 'off',
      'prefer-spread': 'off',
      'no-unused-expressions': 'off',
      'no-case-declarations': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-useless-catch': 'off',
      'no-irregular-whitespace': 'off',
      'no-undef': 'error',
    },
  },
  // api/ 配下（Vercel Serverless / Edge Functions）
  // これまでlintの対象外だったため、既存コードに any が多数残っている。
  // 対象に加えること自体は有益なので、no-explicit-any は当面 warn に落とし、
  // 未定義変数などの実害のある問題だけを error にする。
  {
    files: ['api/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
        // Edge Runtime で使えるWeb標準API
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
    },
  },
  // Only enforce this rule for the router config file to avoid false positives elsewhere.
  {
    files: ['src/router/config.tsx'],
    plugins: {
      'local-route': routeElementPlugin,
    },
    rules: {
      'local-route/route-element-jsx': 'error',
    },
  },
]

