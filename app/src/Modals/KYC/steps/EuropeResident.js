import React from "react";
import PropTypes from "prop-types";
import classnames from "classnames/bind";
import Button from "@material-ui/core/Button";

import style from "../kyc.scss";

import UpperBar from "../../components/upperBar";

import { STEP_TIER2_REQUEST, STEP_NATIONALITY } from "../";

const cx = classnames.bind(style);

const Residence = ({ closeModal, handleAdvanceStep }) => {
  return (
    <>
      <UpperBar closeModal={closeModal} title="Create Account"></UpperBar>
      <div className={cx("modal-body")}>
        <p className={cx("field", "heading")}>
          To start trading on Sight you first need to create an account:
        </p>
        <p className={cx("field", "label")}>Are you an EU resident?</p>
        <div className={cx("modal-buttons")}>
          <Button
            className={cx("material-button")}
            classes={{ label: cx("material-button-label") }}
            variant="contained"
            color="primary"
            size="large"
            onClick={() => handleAdvanceStep(STEP_NATIONALITY)}
          >
            Yes
          </Button>
          <Button
            className={cx("material-button")}
            classes={{ label: cx("material-button-label") }}
            variant="outlined"
            color="primary"
            size="large"
            onClick={() =>
              handleAdvanceStep([
                STEP_TIER2_REQUEST,
                {
                  nonEuResident: true
                }
              ])
            }
          >
            No
          </Button>
        </div>
      </div>
    </>
  );
};

Residence.propTypes = {
  closeModal: PropTypes.func.isRequired,
  handleAdvanceStep: PropTypes.func.isRequired
};

export default Residence;