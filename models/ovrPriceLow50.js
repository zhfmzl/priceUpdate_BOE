import mongoose from "mongoose";
import PlayerReport from "./playerReports.js";

const OvrPriceLowSchema = new mongoose.Schema({
  ovr: {
    type: Number,
    required: true,
  },

  lowList: [
    {
      grade: {
        type: Number,
        required: true,
      },
      player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PlayerReport",
        required: true,
      },
    },
  ],
});

const OvrPriceLow =
  mongoose.models.OvrPriceLow ||
  mongoose.model("OvrPriceLow", OvrPriceLowSchema);

export default OvrPriceLow;
