import { chromium } from "playwright-core";
import mongoose from "mongoose";
import Price from "./models/price.js"; // 확장자 포함 권장 (ESM 기준)
import PlayerReports from "./models/playerReports.js";
// import data from "./data.json" assert { type: "json" };
import dbConnect from "./dbConnect.js";
import playerRestrictions from "./seed/playerRestrictions.json" assert { type: "json" };
import HanTools from "hangul-tools";
import OvrPriceLow from "./models/ovrPriceLow50.js";

let browser;

async function saveToDB(results) {
  const bulkOps = results.map(({ id, prices }) => ({
    updateOne: {
      filter: { id: String(id), "prices.grade": prices.grade },
      update: {
        $set: { "prices.$[elem].price": prices.price },
      },
      arrayFilters: [{ "elem.grade": prices.grade }],
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    try {
      await Price.bulkWrite(bulkOps);
      console.log("📦 MongoDB updated");
    } catch (error) {
      console.error("❌ MongoDB bulkWrite failed:", error.message);
    }
  } else {
    console.log("⚠ No data to save");
  }
}

const playerSearch = async (selectedSeason = "", minOvr = 0) => {
  let selectedSeasons;
  if (Array.isArray(selectedSeason)) {
    selectedSeasons = [...selectedSeason];
  } else {
    selectedSeasons = [selectedSeason];
  }
  const seasonNumbers = [];
  const inputplayer = "";

  // 이미 배열 형태로 전달된 selectedSeasons과 selectedPositions 사용

  for (let season of selectedSeasons) {
    seasonNumbers.push(Number(String(season).slice(-3)));
  }

  let playerReports = [];

  const queryCondition = [{ name: new RegExp(inputplayer) }];

  if (minOvr && minOvr > 10) {
    queryCondition.push({
      "능력치.포지션능력치.최고능력치": {
        $gte: Number(minOvr),
      },
    });
  }

  if (seasonNumbers && seasonNumbers.length > 0) {
    for (let seasonNumber of seasonNumbers) {
      seasonNumber *= 1000000;

      const seasonCondition = {
        id: {
          $gte: seasonNumber,
          $lte: seasonNumber + 999999,
        },
      };

      queryCondition.push(seasonCondition);

      let playerReport = await PlayerReports.find({
        $and: queryCondition,
      })
        .populate({
          path: "선수정보",
          populate: {
            path: "prices", // 중첩된 필드를 처리
            model: "Price",
          },
        })
        .populate({
          path: "선수정보.시즌이미지",
          populate: {
            path: "시즌이미지",
            model: "SeasonId",
          },
        })
        .sort({ "능력치.포지션능력치.포지션최고능력치": -1 })
        .limit(100000);
      queryCondition.pop();
      playerReports = playerReports.concat(playerReport);
    }
  } else {
    let playerReport = await PlayerReports.find({
      $and: queryCondition,
    })
      .populate({
        path: "선수정보",
        populate: {
          path: "prices", // 중첩된 필드를 처리
          model: "Price",
        },
      })
      .populate({
        path: "선수정보.시즌이미지",
        populate: {
          path: "시즌이미지",
          model: "SeasonId",
        },
      })
      .sort({ "능력치.포지션능력치.포지션최고능력치": -1 })
      .limit(10000);

    playerReports = playerReports.concat(playerReport);
  }

  return playerReports;
};

const ovrPriceLow50 = async (List, OVR) => {
  const list = [...List];
  let ovrList = [];
  for (let player of list) {
    if (player.능력치.포지션능력치.최고능력치 === OVR) {
      const ovrPlayer = { grade: 1, player: player };
      ovrList.push(ovrPlayer);
    } else if (player.능력치.포지션능력치.최고능력치 === OVR - 1) {
      const ovrPlayer = { grade: 2, player: player };
      ovrList.push(ovrPlayer);
    } else if (player.능력치.포지션능력치.최고능력치 === OVR - 2) {
      const ovrPlayer = { grade: 3, player: player };
      ovrList.push(ovrPlayer);
    } else if (player.능력치.포지션능력치.최고능력치 === OVR - 4) {
      const ovrPlayer = { grade: 4, player: player };
      ovrList.push(ovrPlayer);
    } else if (player.능력치.포지션능력치.최고능력치 === OVR - 6) {
      const ovrPlayer = { grade: 5, player: player };
      ovrList.push(ovrPlayer);
    } else if (player.능력치.포지션능력치.최고능력치 === OVR - 8) {
      const ovrPlayer = { grade: 6, player: player };
      ovrList.push(ovrPlayer);
    } else if (player.능력치.포지션능력치.최고능력치 === OVR - 11) {
      const ovrPlayer = { grade: 7, player: player };
      ovrList.push(ovrPlayer);
    } else if (player.능력치.포지션능력치.최고능력치 === OVR - 15) {
      const ovrPlayer = { grade: 8, player: player };
      ovrList.push(ovrPlayer);
    }
  }

  ovrList.sort((a, b) => {
    const gradeIndexA = a.grade - 1;
    const gradeIndexB = b.grade - 1;

    try {
      const priceAraw =
        a?.player?.선수정보?.prices?.prices?.[gradeIndexA]?.price;
      const priceBraw =
        b?.player?.선수정보?.prices?.prices?.[gradeIndexB]?.price;

      if (!priceAraw || !priceBraw) return 0;

      const priceA = HanTools.parseNumber(priceAraw.replace(/,/g, ""));
      const priceB = HanTools.parseNumber(priceBraw.replace(/,/g, ""));

      // console.log(
      //   "a:b:",
      //   a?.player?.선수정보?.prices,
      //   b?.player?.선수정보?.prices
      // );

      return priceA - priceB;
    } catch (err) {
      console.error("❌ 가격 정렬 중 에러:", err.message);
      return 0;
    }
  });
  ovrList = ovrList.slice(0, 50);

  await OvrPriceLow.updateOne(
    { ovr: Number(OVR) },
    {
      $set: {
        lowList: ovrList.map((entry) => ({
          grade: entry.grade,
          player: entry.player._id,
        })),
      },
    },
    { upsert: true }
  );

  console.log(`✅ ${OVR}  DB에 저장됨`);
};

async function main() {
  try {
    await dbConnect();

    // --------------------------------------  22HR,23HR,23HW,24EP,24HR,25HR,24KB,25KL,2012KH,BDO,BLD,BTB,CAP,CC,ChelseaAmbassador,COC,CU,DC,EBS,FA,FCA,GR,GRU,HG,HOT,JNM,JVA,LE,LH,LivepoolAmbassador,LN,LOL,MC,MDL,MOG,NHD,NO7,NTG,OTW,RMCF,RTN,SPL,TB,TC,TKI,TKL,TT,UP,UT,VTR,WB--------------------------------------

    const LIST = await playerSearch([
      261, 281, 291, 826, 811, 835, 830, 516, 247, 827, 828, 253, 256, 252, 289,
      254, 217, 825, 802, 251, 264, 290, 210, 829, 283, 216, 813, 801, 840, 234,
      236, 268, 265, 237, 821, 233, 201, 839, 249, 218, 274, 284, 270, 206, 214,
      202, 225, 207, 246, 814, 231, 836,
    ]); // playerSearch(시즌넘버, 최소오버롤)

    for (let i = 105; i <= 130; i++) {
      await ovrPriceLow50(LIST, i);
    }

    // await ovrPriceLow50(LIST, 117);

    // console.log("list:", LIST);
    // await saveToDB(WB_RESULTS);

    // -------------------------------------------------------------------------------------------------------------------------------

    console.log("✅ Crawling process completed.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error in crawler:", error.message);
    process.exit(1);
  }
}

main();
