import { REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";
import {
  jsxWithValidationStatic,
  jsxWithValidationDynamic,
  // jsxWithValidation,
} from "./ReactJSXElementValidator";
import { jsx as jsxProd } from "./ReactJSXElement";

const jsx = __DEV__ ? jsxWithValidationDynamic : jsxProd;
// we may want to special case jsxs internally to take advantage of static children.
// for now we can ship identical prod functions
const jsxs = __DEV__ ? jsxWithValidationStatic : jsxProd;
/** 开发环境时JSX校验 */
// const jsxDEV = __DEV__ ? jsxWithValidation : undefined;
const jsxDEV = jsxProd;

export { REACT_FRAGMENT_TYPE as Fragment, jsx, jsxs, jsxDEV };
