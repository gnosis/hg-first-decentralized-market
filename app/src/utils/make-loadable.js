import React, { useState, useEffect } from "react";
import cn from "classnames/bind";

import style from "Root/root.scss";
const cx = cn.bind(style);

import Spinner from "components/Spinner";
import CrashPage from "components/Crash";

const makeLoadable = (Component, props, childComponents) => {
  const loadableWrapped = () => {
    const [loadingState, setLoadingState] = useState("LOADING");
    const [loadedComponents, setLoadedComponents] = useState([]);

    useEffect(() => {
      (async () => {
        setLoadingState("LOADING");
        try {
          const loadedChildren = await Promise.all(
            childComponents.map(loader => loader())
          );

          setLoadedComponents(
            loadedChildren.map(
              ({ default: exportedComponent }) => exportedComponent
            )
          );
          setLoadingState("SUCCESS");
        } catch (err) {
          console.error(err);
          setLoadingState("ERROR");
        }
      })();
    }, []);

    if (loadingState === "LOADING") {
      return (
        <div className={cx("loading-page")}>
          <Spinner centered width={100} height={100} />
        </div>
      );
    }

    if (loadingState === "ERROR") {
      return <CrashPage />;
    }

    if (loadingState === "SUCCESS") {
      return <Component {...props} childComponents={loadedComponents} />;
    }
  };

  return loadableWrapped;
};

export default makeLoadable;
