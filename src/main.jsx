/* eslint-disable no-unused-vars */
import * as React from "react";
import * as ReactDOM from "react-dom/client";

const element = <div ref={{ current: "Hello" }}>Hello React</div>;

const root = ReactDOM.createRoot(document.getElementById("root"));

console.log("root", root);

root.render(element);
