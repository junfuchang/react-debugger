/**
 * ReactElementValidator 提供了一个元素工厂的包装器，它验证传递给元素的道具。这旨在仅在 DEV 中使用，并且可以由支持它的语言的静态类型检查器替换。
 */
import isValidElementType from "shared/isValidElementType";
import getComponentNameFromType from "shared/getComponentNameFromType";
import checkPropTypes from "shared/checkPropTypes";
import {
  getIteratorFn,
  REACT_FORWARD_REF_TYPE,
  REACT_MEMO_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_ELEMENT_TYPE,
} from "shared/ReactSymbols";
import hasOwnProperty from "shared/hasOwnProperty";
import isArray from "shared/isArray";
import { jsxDEV } from "./ReactJSXElement";

import { describeUnknownElementTypeFrameInDEV } from "shared/ReactComponentStackFrame";

import ReactSharedInternals from "shared/ReactSharedInternals";

const ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;
const ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;

const REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");

function setCurrentlyValidatingElement(element) {
  if (__DEV__) {
    if (element) {
      const owner = element._owner;
      const stack = describeUnknownElementTypeFrameInDEV(
        element.type,
        element._source,
        owner ? owner.type : null
      );
      ReactDebugCurrentFrame.setExtraStackFrame(stack);
    } else {
      ReactDebugCurrentFrame.setExtraStackFrame(null);
    }
  }
}

let propTypesMisspellWarningShown;

if (__DEV__) {
  propTypesMisspellWarningShown = false;
}

/**
 * Verifies the object is a ReactElement.
 * See https://reactjs.org/docs/react-api.html#isvalidelement
 * @param {?object} object
 * @return {boolean} True if `object` is a ReactElement.
 * @final
 */
export function isValidElement(object) {
  if (__DEV__) {
    return (
      typeof object === "object" &&
      object !== null &&
      object.$$typeof === REACT_ELEMENT_TYPE
    );
  }
}

function getDeclarationErrorAddendum() {
  if (__DEV__) {
    if (ReactCurrentOwner.current) {
      const name = getComponentNameFromType(ReactCurrentOwner.current.type);
      if (name) {
        return "\n\nCheck the render method of `" + name + "`.";
      }
    }
    return "";
  }
}

function getSourceInfoErrorAddendum(source) {
  if (__DEV__) {
    if (source !== undefined) {
      // eslint-disable-next-line no-useless-escape
      const fileName = source.fileName.replace(/^.*[\\\/]/, "");
      const lineNumber = source.lineNumber;
      return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
    }
    return "";
  }
}

/**
 * Warn if there's no key explicitly set on dynamic arrays of children or
 * object keys are not valid. This allows us to keep track of children between
 * updates.
 */
const ownerHasKeyUseWarning = {};

function getCurrentComponentErrorInfo(parentType) {
  if (__DEV__) {
    let info = getDeclarationErrorAddendum();

    if (!info) {
      const parentName =
        typeof parentType === "string"
          ? parentType
          : parentType.displayName || parentType.name;
      if (parentName) {
        info = `\n\nCheck the top-level render call using <${parentName}>.`;
      }
    }
    return info;
  }
}

/**
 * Warn if the element doesn't have an explicit key assigned to it.
 * This element is in an array. The array could grow and shrink or be
 * reordered. All children that haven't already been validated are required to
 * have a "key" property assigned to it. Error statuses are cached so a warning
 * will only be shown once.
 *
 * @internal
 * @param {ReactElement} element Element that requires a key.
 * @param {*} parentType element's parent's type.
 */
function validateExplicitKey(element, parentType) {
  if (__DEV__) {
    if (!element._store || element._store.validated || element.key != null) {
      return;
    }
    element._store.validated = true;

    const currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
    if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
      return;
    }
    ownerHasKeyUseWarning[currentComponentErrorInfo] = true;

    // Usually the current owner is the offender, but if it accepts children as a
    // property, it may be the creator of the child that's responsible for
    // assigning it a key.
    let childOwner = "";
    if (
      element &&
      element._owner &&
      element._owner !== ReactCurrentOwner.current
    ) {
      // Give the component that originally created this child.
      childOwner = ` It was passed a child from ${getComponentNameFromType(
        element._owner.type
      )}.`;
    }

    setCurrentlyValidatingElement(element);
    console.error(
      'Each child in a list should have a unique "key" prop.' +
        "%s%s See https://reactjs.org/link/warning-keys for more information.",
      currentComponentErrorInfo,
      childOwner
    );
    setCurrentlyValidatingElement(null);
  }
}

/**
 * Ensure that every element either is passed in a static location, in an
 * array with an explicit keys property defined, or in an object literal
 * with valid key property.
 *
 * @internal
 * @param {ReactNode} node Statically passed child of any type.
 * @param {*} parentType node's parent's type.
 */
function validateChildKeys(node, parentType) {
  if (__DEV__) {
    if (typeof node !== "object" || !node) {
      return;
    }
    if (node.$$typeof === REACT_CLIENT_REFERENCE) {
      // This is a reference to a client component so it's unknown.
    } else if (isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const child = node[i];
        if (isValidElement(child)) {
          validateExplicitKey(child, parentType);
        }
      }
    } else if (isValidElement(node)) {
      // This element was passed in a valid location.
      if (node._store) {
        node._store.validated = true;
      }
    } else {
      const iteratorFn = getIteratorFn(node);
      if (typeof iteratorFn === "function") {
        // Entry iterators used to provide implicit keys,
        // but now we print a separate warning for them later.
        if (iteratorFn !== node.entries) {
          const iterator = iteratorFn.call(node);
          let step;
          while (!(step = iterator.next()).done) {
            if (isValidElement(step.value)) {
              validateExplicitKey(step.value, parentType);
            }
          }
        }
      }
    }
  }
}

/**
 * Given an element, validate that its props follow the propTypes definition,
 * provided by the type.
 *
 * @param {ReactElement} element
 */
function validatePropTypes(element) {
  if (__DEV__) {
    const type = element.type;
    if (type === null || type === undefined || typeof type === "string") {
      return;
    }
    if (type.$$typeof === REACT_CLIENT_REFERENCE) {
      return;
    }
    let propTypes;
    if (typeof type === "function") {
      propTypes = type.propTypes;
    } else if (
      typeof type === "object" &&
      (type.$$typeof === REACT_FORWARD_REF_TYPE ||
        // Note: Memo only checks outer props here.
        // Inner props are checked in the reconciler.
        type.$$typeof === REACT_MEMO_TYPE)
    ) {
      propTypes = type.propTypes;
    } else {
      return;
    }
    if (propTypes) {
      // Intentionally inside to avoid triggering lazy initializers:
      const name = getComponentNameFromType(type);
      checkPropTypes(propTypes, element.props, "prop", name, element);
    } else if (type.PropTypes !== undefined && !propTypesMisspellWarningShown) {
      propTypesMisspellWarningShown = true;
      // Intentionally inside to avoid triggering lazy initializers:
      const name = getComponentNameFromType(type);
      console.error(
        "Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?",
        name || "Unknown"
      );
    }
    if (
      typeof type.getDefaultProps === "function" &&
      !type.getDefaultProps.isReactClassApproved
    ) {
      console.error(
        "getDefaultProps is only used on classic React.createClass " +
          "definitions. Use a static property named `defaultProps` instead."
      );
    }
  }
}

/**
 * Given a fragment, validate that it can only be provided with fragment props
 * @param {ReactElement} fragment
 */
function validateFragmentProps(fragment) {
  if (__DEV__) {
    const keys = Object.keys(fragment.props);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key !== "children" && key !== "key") {
        setCurrentlyValidatingElement(fragment);
        console.error(
          "Invalid prop `%s` supplied to `React.Fragment`. " +
            "React.Fragment can only have `key` and `children` props.",
          key
        );
        setCurrentlyValidatingElement(null);
        break;
      }
    }

    if (fragment.ref !== null) {
      setCurrentlyValidatingElement(fragment);
      console.error("Invalid attribute `ref` supplied to `React.Fragment`.");
      setCurrentlyValidatingElement(null);
    }
  }
}

const didWarnAboutKeySpread = {};

/** babel JSX校验 函数的参数是babel传进来的 */
export function jsxWithValidation(
  type,
  props,
  key,
  isStaticChildren,
  source,
  self
) {
  if (__DEV__) {
    // JSX类型校验
    const validType = isValidElementType(type);
    // 在这种情况下我们会发出警告但不会抛出。我们希望元素创建成功，并且渲染中可能会出现错误。
    if (!validType) {
      let info = "";
      if (
        type === undefined ||
        (typeof type === "object" &&
          type !== null &&
          Object.keys(type).length === 0)
      ) {
        // “您可能忘记从文件中导出您的组件它在中定义，或者您可能混淆了默认导入和命名导入。”
        info +=
          " You likely forgot to export your component from the file " +
          "it's defined in, or you might have mixed up default and named imports.";
      }

      //
      const sourceInfo = getSourceInfoErrorAddendum(source);
      if (sourceInfo) {
        info += sourceInfo;
      } else {
        info += getDeclarationErrorAddendum();
      }

      let typeString;
      if (type === null) {
        typeString = "null";
      } else if (isArray(type)) {
        typeString = "array";
      } else if (type !== undefined && type.$$typeof === REACT_ELEMENT_TYPE) {
        typeString = `<${getComponentNameFromType(type.type) || "Unknown"} />`;
        info =
          " Did you accidentally export a JSX literal instead of a component?";
      } else {
        typeString = typeof type;
      }

      console.error(
        "React.jsx: type is invalid -- expected a string (for " +
          "built-in components) or a class/function (for composite " +
          "components) but got: %s.%s",
        typeString,
        info
      );
    }

    const element = jsxDEV(type, props, key, source, self);

    //如果使用模拟或自定义函数，结果可能为空。    //TODO：当这些不再被允许作为类型参数时，请删除它。
    if (element == null) {
      return element;
    }

    //如果类型无效，则跳过密钥警告，因为我们的密钥验证逻辑
    //不期望非字符串/函数类型并且会抛出令人困惑的错误。
    //我们不希望 dev 和 prod 之间的异常行为不同。
    //（渲染将抛出一条有用的消息，一旦类型是
    //已修复，将出现关键警告。）
    if (validType) {
      const children = props.children;
      if (children !== undefined) {
        if (isStaticChildren) {
          if (isArray(children)) {
            for (let i = 0; i < children.length; i++) {
              validateChildKeys(children[i], type);
            }

            if (Object.freeze) {
              Object.freeze(children);
            }
          } else {
            console.error(
              "React.jsx: Static children should always be an array. " +
                "You are likely explicitly calling React.jsxs or React.jsxDEV. " +
                "Use the Babel transform instead."
            );
          }
        } else {
          validateChildKeys(children, type);
        }
      }
    }

    if (hasOwnProperty.call(props, "key")) {
      const componentName = getComponentNameFromType(type);
      const keys = Object.keys(props).filter((k) => k !== "key");
      const beforeExample =
        keys.length > 0
          ? "{key: someKey, " + keys.join(": ..., ") + ": ...}"
          : "{key: someKey}";
      if (!didWarnAboutKeySpread[componentName + beforeExample]) {
        const afterExample =
          keys.length > 0 ? "{" + keys.join(": ..., ") + ": ...}" : "{}";
        console.error(
          'A props object containing a "key" prop is being spread into JSX:\n' +
            "  let props = %s;\n" +
            "  <%s {...props} />\n" +
            "React keys must be passed directly to JSX without using spread:\n" +
            "  let props = %s;\n" +
            "  <%s key={someKey} {...props} />",
          beforeExample,
          componentName,
          afterExample,
          componentName
        );
        didWarnAboutKeySpread[componentName + beforeExample] = true;
      }
    }

    if (type === REACT_FRAGMENT_TYPE) {
      validateFragmentProps(element);
    } else {
      validatePropTypes(element);
    }

    return element;
  }
}

// 这两个函数的存在是为了在 dev 中仍然获得子警告，即使使用 prod 转换也是如此。这意味着 jsxDEV 纯粹是选择加入行为以获得更好的消息，但如果您使用生产 api，我们不会停止向您发出警告。
export function jsxWithValidationStatic(type, props, key) {
  if (__DEV__) {
    return jsxWithValidation(type, props, key, true);
  }
}

export function jsxWithValidationDynamic(type, props, key) {
  if (__DEV__) {
    return jsxWithValidation(type, props, key, false);
  }
}
