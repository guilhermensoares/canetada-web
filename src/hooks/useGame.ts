import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { GameState, PolicyKey, SustainabilityKey, TaxKey, Lang, ZoneTool, StateBuildKind } from "@/game/types";
import { paintRoad, type RoadTool } from "@/game/roads";
import { DEFAULT_MAYOR, type Mayor } from "@/game/mayor";
import { findPolitician as __findPolitician } from "@/game/politicianPresets";
import { saveCareerToHall as __saveCareerToHall } from "@/game/journey";
import { toast as __toast } from "sonner";
import {
  openBiddingForCategory,
  awardBidding as awardPublicBidding,
  cancelBidding as cancelPublicBidding,
} from "@/game/bidding";
import {
  initialState,
  STORAGE_KEY,

  dayTick,
  resolveEvent,
} from "@/game/logic";
import { mark as __perfMark } from "@/game/perf";
import {
  setPolicy,
  setSustainability,
  setTax,
  expandWater,
  expandEnergy,
  takeLoan,
  payDebt,
  paintTile,
  buildStructure,
  urbanizeFavela,
  ensureZoning,
} from "@/game/logic";
import {
  invitePartyToCoalition,
  ejectPartyFromCoalition,
  foundSisterCity,
  applyMultilateralGrant,
  requestTransfer,
  respondToGroup,
  spendCampaign,
  acknowledgeElection,
  type PartyId,
  type GroupId,
  type TransferKind,
} from "@/game/politics";
import { respondPartyDemand, dismissPartyDemand, maybeCreatePartyDemand } from "@/game/partyDemands";
import {
  proposeBill,
  boostBill,
  callVote,
  withdrawBill,
} from "@/game/legislature";
import { seededRng } from "@/game/rng";
import {
  openBidding,
  awardBid,
  cancelBidding,
  setModeFare,
  setModeSubsidy,
  buildBrtCorridor,
  buildMetroStation,
  setCrackdown,
  legalizeInformal,
  buildCycleway,
  setFuelPrice,
  setFareModel,
  toggleFareIntegration,
  setTransferWindow,
  setCorporateMobilityTax,
  setVehicleMobilityFee,
  setElectrifyInvestment,
  toggleRequireElectricBids,
  expandRoadway,
  buildCalmingZone,
  toggleReversibleLanes,
  toggleSmartSignals,
  setPaidParkingCoverage,
  setParkingFee,
  type TransportModeId,
  type FareModel,
} from "@/game/transport";
import {
  buildDrainagePipe,
  buildPiscinao,
  setSanitationModel,
  setSanitationInvestment,
  setSanitationTariff,
  setWasteMode,
  fundCooperative,
  setPipeReplacementInvestment,

  type SanitationModel,
  type WasteMode,
} from "@/game/climate";
import { setInformalPolicy, type InformalPolicy } from "@/game/informality";
import {
  setTeacherSalary,
  setSchoolTransport,
  fundTechCenter,
  closeTechCenter,
} from "@/game/intergenerational";
import { setHousingPolicy, type HousingPolicy } from "@/game/housing";
import {
  setDoctrine,
  setSocialInvestment,
  runOperation,
  type EnforcementDoctrine,
} from "@/game/parallelPower";
import {
  investContainment,
  relocateHouseholds,
  setLandslideThreshold,
  setContainmentBudget,
  crisisEvacuate,
  crisisOpenShelter,
  crisisCoordinateDonations,
} from "@/game/disasters";
import {
  setPosture as setMevPosture,
  setSecurityRatio as setMevSecurityRatio,
  setCultureBudget as setMevCultureBudget,
  fundCulturalSpot,
  resolveDilemma as resolveMevDilemma,
  type ActivityKey,
  type Posture,
} from "@/game/massEvents";
import {
  payMpSettlement,
  contestTceRuling,
  resumeStalledWork,
  defendMandate,
} from "@/game/oversight";
import { negotiateOccupation, evictOccupation } from "@/game/landConflict";
import { officialBriefing } from "@/game/media";
import { dispatchPoliceUnits } from "@/game/policeShow";
import { setCommsBudget, debunkMessage, markChatRead } from "@/game/zapzap";
import { decideEmail, markInboxRead, type InboxDecision } from "@/game/inbox";
import {
  offerEmenda, cedeMinistry, revokeMinistry, investigateCPI,
  type MinistryId,
} from "@/game/negotiation";
import {
  acceptCoalition, rejectCoalition, makePromise, setMayorTv,
  startDebate, mayorDebateResponse,
  type DebateTopic, type DebateStrategy,
} from "@/game/campaign";
import { respondCrisis as piupiuRespond, markAllRead as piupiuMarkRead } from "@/game/piupiu";
import { decideTowAndOwn, decideBotFarm, decideIgnore } from "@/game/cascade";
import {
  hireAgency as coHire, fireAgency as coFire,
  launchBotFarm as coLaunchBot, cancelBotOp as coCancelBot,
  hireInfluencerCampaign as coHireInflu,
  type AgencyId, type BotTactic, type InfluencerCampaign,
} from "@/game/covertOps";
import {
  hireAdvisor, fireAdvisor, trainAdvisor, retainAdvisor, releasePoached,
  setInitialCabinet,
  type PortfolioId, type Advisor,
} from "@/game/advisors";
import {
  createGhost, removeGhost, launchShell, bribeCouncil, fundBotsFromSlush,
  resolveDelacao, dismissPlea, type PleaChoice,
} from "@/game/corruption";




type Action =
  | { type: "tick" }
  | { type: "setSpeed"; speed: GameState["speed"] }
  | { type: "setLang"; lang: Lang }
  | { type: "setCityName"; name: string }
  | { type: "policy"; key: PolicyKey; value: number }
  | { type: "sustainability"; key: SustainabilityKey; value: number }
  | { type: "tax"; key: TaxKey; value: number }
  | { type: "expandWater" }
  | { type: "expandEnergy" }
  | { type: "loan" }
  | { type: "payDebt" }
  | { type: "resolveEvent"; choice: number }
  | { type: "reset"; seed?: string }
  | { type: "startGame"; presetId?: string; cityName: string; seed: string; lang: Lang; mayor: Mayor; scaleId?: string; scenarioId?: string; sandbox?: import("@/game/scenarios").SandboxOverrides; growthMode?: boolean; mode?: "sandbox" | "mayor"; difficulty?: import("@/game/difficulty").DifficultyLevel; initialCabinet?: Partial<Record<import("@/game/advisors").PortfolioId, import("@/game/advisors").Advisor>> }
  | { type: "tutorialSetStep"; step: number }

  | { type: "bidding"; op:
      | { kind: "open"; category: import("@/game/bidding").WorkCategory; district: import("@/game/districts").DistrictKind }
      | { kind: "award"; bidId: string; proposalId: string }
      | { kind: "cancel"; bidId: string } }
  | { type: "setSeed"; seed: string }
  | { type: "setMayor"; mayor: Mayor }
  | { type: "paint"; x: number; y: number; tool: ZoneTool }
  | { type: "paintRoad"; x: number; y: number; tool: RoadTool }
  | { type: "build"; x: number; y: number; kind: StateBuildKind }
  | { type: "urbanize" }
  | { type: "coalitionJoin"; id: PartyId }
  | { type: "coalitionLeave"; id: PartyId }
  | { type: "partyDemand"; op: { kind: "respond"; response: "accept" | "decline" } | { kind: "dismiss" } }
  | { type: "sisterCity" }
  | { type: "multilateralGrant" }
  | { type: "requestTransfer"; kind: TransferKind }
  | { type: "respondGroup"; id: GroupId; mode: "concede" | "confront" }
  | { type: "campaign"; amount: number }
  | { type: "ackElection" }
  | { type: "landPolicy"; patch: Partial<GameState["landPolicy"]> }
  | { type: "bill"; op:
      | { kind: "propose"; templateId: string }
      | { kind: "boost"; billId: string; spend: number }
      | { kind: "vote"; billId: string }
      | { kind: "withdraw"; billId: string } }
  | { type: "transport"; op:
      | { kind: "openBidding" }
      | { kind: "awardBid"; bidId: string }
      | { kind: "cancelBidding" }
      | { kind: "setFare"; mode: TransportModeId; value: number }
      | { kind: "setSubsidy"; mode: TransportModeId; value: number }
      | { kind: "buildBrt" }
      | { kind: "buildMetro" }
      | { kind: "setCrackdown"; value: number }
      | { kind: "legalizeInformal" }
      | { kind: "buildCycleway" }
      | { kind: "setFuelPrice"; value: number }
      | { kind: "setFareModel"; model: FareModel }
      | { kind: "toggleIntegration" }
      | { kind: "setTransferWindow"; value: number }
      | { kind: "setCorporateMobilityTax"; value: number }
      | { kind: "setVehicleMobilityFee"; value: number }
      | { kind: "setElectrifyInvestment"; value: number }
      | { kind: "toggleRequireElectricBids" }
      | { kind: "expandRoadway" }
      | { kind: "buildCalmingZone" }
      | { kind: "toggleReversibleLanes" }
      | { kind: "toggleSmartSignals" }
      | { kind: "setPaidParkingCoverage"; value: number }
      | { kind: "setParkingFee"; value: number } }
  | { type: "climate"; op:
      | { kind: "buildDrainage" }
      | { kind: "buildPiscinao" }
      | { kind: "setSanModel"; model: SanitationModel }
      | { kind: "setSanInvestment"; value: number }
      | { kind: "setSanTariff"; value: number }
      | { kind: "setWasteMode"; mode: WasteMode }
      | { kind: "fundCooperative" }
      | { kind: "setPipeReplacement"; value: number } }

  | { type: "informal"; patch: Partial<import("@/game/informality").InformalPolicy> }
  | { type: "education"; op:
      | { kind: "teacherSalary"; value: number }
      | { kind: "schoolTransport"; value: number }
      | { kind: "fundTechCenter" }
      | { kind: "closeTechCenter" } }
  | { type: "housing"; patch: Partial<HousingPolicy> }
  | { type: "parallel"; op:
      | { kind: "setDoctrine"; doctrine: EnforcementDoctrine }
      | { kind: "setSocialInvestment"; value: number }
      | { kind: "runOperation" } }
  | { type: "disaster"; op:
      | { kind: "invest"; areaId: string }
      | { kind: "relocate"; areaId: string; batch?: number }
      | { kind: "threshold"; value: number }
      | { kind: "budget"; value: number }
      | { kind: "evacuate" }
      | { kind: "shelter" }
      | { kind: "donations" } }
  | { type: "massEvent"; op:
      | { kind: "setPosture"; activity: ActivityKey; posture: Posture }
      | { kind: "setSecurityRatio"; value: number }
      | { kind: "setCultureBudget"; value: number }
      | { kind: "fundSpot" }
      | { kind: "resolveDilemma"; choiceIdx: number } }
  | { type: "oversight"; op:
      | { kind: "payMp" }
      | { kind: "contestTce" }
      | { kind: "resumeWork"; workId: string }
      | { kind: "defendMandate" } }
  | { type: "landConflict"; op:
      | { kind: "negotiate"; id: string }
      | { kind: "evict"; id: string } }
  | { type: "media"; op: { kind: "briefing" } }
  | { type: "policeShow"; op: { kind: "dispatch" } }
  | { type: "zapzap"; op:
      | { kind: "setBudget"; value: number }
      | { kind: "debunk"; id: string }
      | { kind: "markRead" } }
  | { type: "negotiation"; op:
      | { kind: "emenda"; billId: string; vereadorId: string; amount: number }
      | { kind: "cedeMinistry"; ministry: MinistryId; party: PartyId }
      | { kind: "revokeMinistry"; ministry: MinistryId }
      | { kind: "investigateCPI" } }
  | { type: "electionCampaign"; op:
      | { kind: "acceptCoalition"; id: string }
      | { kind: "rejectCoalition"; id: string }
      | { kind: "promise"; topic: DebateTopic }
      | { kind: "setTv"; share: number }
      | { kind: "startDebate"; topic: DebateTopic }
      | { kind: "debate"; strategy: DebateStrategy } }
  | { type: "inbox"; op:
      | { kind: "decide"; id: string; decision: InboxDecision }
      | { kind: "markRead" } }
  | { type: "piupiu"; op:
      | { kind: "respond"; triggerId: string; response: "official_note" | "humor" | "field_team" }
      | { kind: "markRead" } }
  | { type: "covertOps"; op:
      | { kind: "hireAgency"; agency: AgencyId }
      | { kind: "fireAgency"; agency: AgencyId }
      | { kind: "launchBot"; agency: AgencyId; tactic: BotTactic; monthlyBudget: number; target?: string }
      | { kind: "cancelBot"; opId: string }
      | { kind: "hireInfluencer"; agency: AgencyId; campaign: InfluencerCampaign } }
  | { type: "cascade"; op: { kind: "tow" } | { kind: "bot" } | { kind: "ignore" } }
  | { type: "advisor"; op:
      | { kind: "hire"; candidateId: string; portfolio: PortfolioId }
      | { kind: "fire"; portfolio: PortfolioId }
      | { kind: "train"; portfolio: PortfolioId }
      | { kind: "retain"; portfolio: PortfolioId }
      | { kind: "release"; portfolio: PortfolioId } }
  | { type: "corruption"; op:
      | { kind: "ghost"; portfolio: PortfolioId }
      | { kind: "removeGhost"; id: string }
      | { kind: "shell"; portfolio: PortfolioId; baseValue: number; overpricePct: number }
      | { kind: "bribe"; amount: number }
      | { kind: "fundBots"; amount: number }
      | { kind: "plea"; choice: PleaChoice }
      | { kind: "dismissPlea" } }
  | { type: "hydrate"; state: GameState }
  | { type: "useSecondChance" }
  | { type: "clearEndOfCareer" };


function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "tick": {
      const __t0 = performance.now();
      const next = dayTick(state);
      __perfMark("tick", performance.now() - __t0);
      return next;
    }
    case "setSpeed":
      return { ...state, speed: action.speed };
    case "setLang":
      return { ...state, lang: action.lang };
    case "setCityName":
      return { ...state, cityName: action.name };
    case "policy":
      return setPolicy(state, action.key, action.value);
    case "sustainability":
      return setSustainability(state, action.key, action.value);
    case "tax":
      return setTax(state, action.key, action.value);
    case "expandWater":
      if (state.fiscal?.infracaoFiscal) return state;
      return expandWater(state);
    case "expandEnergy":
      if (state.fiscal?.infracaoFiscal) return state;
      return expandEnergy(state);
    case "loan":
      return takeLoan(state);
    case "payDebt":
      return payDebt(state);
    case "resolveEvent":
      return resolveEvent(state, action.choice);
    case "reset":
      return initialState(state.cityName, action.seed);
    case "startGame": {
      const fresh = initialState(action.cityName, {
        seed: action.seed,
        presetId: action.presetId,
        mayor: action.mayor,
        scaleId: action.scaleId,
        scenarioId: action.scenarioId,
        sandbox: action.sandbox,
        growthMode: action.growthMode,
        mode: action.mode,
        difficulty: action.difficulty,
      });
      fresh.lang = action.lang;
      fresh.tutorialStep = 0;
      fresh.speed = 0;
      if (action.initialCabinet) {
        setInitialCabinet(fresh, action.initialCabinet);
      }
      return fresh;
    }

    case "tutorialSetStep": {
      // Stamp when the tour actually finishes so logic.ts can grant a grace
      // window. Only set once (don't reset on subsequent 999 dispatches).
      const justFinished = action.step >= 999 && !state.tourEndedAt;
      return {
        ...state,
        tutorialStep: action.step,
        tourEndedAt: justFinished
          ? { month: state.month, year: state.year }
          : state.tourEndedAt,
      };
    }
    case "setSeed":

      return { ...state, seed: action.seed.trim() || state.seed, rngCursor: 0 };
    case "setMayor":
      return { ...state, mayor: action.mayor };
    case "paint":
      return paintTile(state, action.x, action.y, action.tool);
    case "paintRoad":
      if (state.fiscal?.infracaoFiscal && action.tool !== "off") return state;
      return paintRoad(state, action.x, action.y, action.tool);
    case "build":
      if (state.fiscal?.infracaoFiscal) return state;
      return buildStructure(state, action.kind, action.x, action.y);
    case "urbanize":
      if (state.fiscal?.infracaoFiscal) return state;
      return urbanizeFavela(state);
    case "coalitionJoin": {
      const before = state.politics?.council.coalition.includes(action.id) ?? false;
      const next = invitePartyToCoalition(state, action.id, seededRng(state.seed, state));
      const after = next.politics?.council.coalition.includes(action.id) ?? false;
      // Só dispara demanda quando o convite mudou de "fora" para "dentro".
      if (!before && after) {
        maybeCreatePartyDemand(next, action.id, seededRng(next.seed, next));
      }
      return next;
    }
    case "coalitionLeave":
      return ejectPartyFromCoalition(state, action.id);
    case "partyDemand": {
      if (action.op.kind === "respond") return respondPartyDemand(state, action.op.response);
      return dismissPartyDemand(state);
    }
    case "sisterCity":
      return foundSisterCity(state);
    case "multilateralGrant":
      return applyMultilateralGrant(state, seededRng(state.seed, state));
    case "requestTransfer":
      return requestTransfer(state, action.kind, seededRng(state.seed, state));
    case "respondGroup":
      return respondToGroup(state, action.id, action.mode);
    case "campaign":
      return spendCampaign(state, action.amount);
    case "ackElection":
      return acknowledgeElection(state);
    case "clearEndOfCareer": {
      const next = structuredClone(state);
      if (next.journey) next.journey.careerEnded = undefined;
      if (next.politics?.election) next.politics.election.pendingResult = undefined;
      if (next.oversight?.impeachment && next.oversight.impeachment.verdict === "removed") {
        next.oversight.impeachment = undefined as unknown as typeof next.oversight.impeachment;
      }
      return next;
    }
    case "landPolicy":
      return { ...state, landPolicy: { ...state.landPolicy, ...action.patch } };
    case "informal":
      return setInformalPolicy(state, action.patch);
    case "bill": {
      const op = action.op;
      switch (op.kind) {
        case "propose":  return proposeBill(state, op.templateId);
        case "boost":    return boostBill(state, op.billId, op.spend);
        case "vote":     return callVote(state, op.billId, seededRng(state.seed, state));
        case "withdraw": return withdrawBill(state, op.billId);
      }
      return state;
    }
    case "transport": {
      const s = structuredClone(state);
      const op = action.op;
      switch (op.kind) {
        case "openBidding":       openBidding(s, seededRng(s.seed, s)); break;
        case "awardBid":          awardBid(s, op.bidId); break;
        case "cancelBidding":     cancelBidding(s); break;
        case "setFare":           setModeFare(s, op.mode, op.value); break;
        case "setSubsidy":        setModeSubsidy(s, op.mode, op.value); break;
        case "buildBrt":          buildBrtCorridor(s); break;
        case "buildMetro":        buildMetroStation(s); break;
        case "setCrackdown":      setCrackdown(s, op.value); break;
        case "legalizeInformal":  legalizeInformal(s); break;
        case "buildCycleway":     buildCycleway(s); break;
        case "setFuelPrice":      setFuelPrice(s, op.value); break;
        case "setFareModel":      setFareModel(s, op.model); break;
        case "toggleIntegration": toggleFareIntegration(s); break;
        case "setTransferWindow": setTransferWindow(s, op.value); break;
        case "setCorporateMobilityTax": setCorporateMobilityTax(s, op.value); break;
        case "setVehicleMobilityFee":   setVehicleMobilityFee(s, op.value); break;
        case "setElectrifyInvestment":  setElectrifyInvestment(s, op.value); break;
        case "toggleRequireElectricBids": toggleRequireElectricBids(s); break;
        case "expandRoadway":       expandRoadway(s); break;
        case "buildCalmingZone":    buildCalmingZone(s); break;
        case "toggleReversibleLanes": toggleReversibleLanes(s); break;
        case "toggleSmartSignals":  toggleSmartSignals(s); break;
        case "setPaidParkingCoverage": setPaidParkingCoverage(s, op.value); break;
        case "setParkingFee":       setParkingFee(s, op.value); break;
      }
      return s;
    }
    case "climate": {
      const s = structuredClone(state);
      const op = action.op;
      switch (op.kind) {
        case "buildDrainage":    buildDrainagePipe(s); break;
        case "buildPiscinao":    buildPiscinao(s); break;
        case "setSanModel":      setSanitationModel(s, op.model); break;
        case "setSanInvestment": setSanitationInvestment(s, op.value); break;
        case "setSanTariff":     setSanitationTariff(s, op.value); break;
        case "setWasteMode":     setWasteMode(s, op.mode); break;
        case "fundCooperative":  fundCooperative(s); break;
        case "setPipeReplacement": setPipeReplacementInvestment(s, op.value); break;

      }
      return s;
    }
    case "education": {
      const op = action.op;
      switch (op.kind) {
        case "teacherSalary":   return setTeacherSalary(state, op.value);
        case "schoolTransport": return setSchoolTransport(state, op.value);
        case "fundTechCenter":  return fundTechCenter(state);
        case "closeTechCenter": return closeTechCenter(state);
      }
      return state;
    }
    case "housing":
      return setHousingPolicy(state, action.patch);
    case "parallel": {
      const s = structuredClone(state);
      const op = action.op;
      switch (op.kind) {
        case "setDoctrine":         setDoctrine(s, op.doctrine); break;
        case "setSocialInvestment": setSocialInvestment(s, op.value); break;
        case "runOperation":        runOperation(s); break;
      }
      return s;
    }
    case "disaster": {
      let s = structuredClone(state);
      const op = action.op;
      switch (op.kind) {
        case "invest":    s = investContainment(s, op.areaId); break;
        case "relocate":  s = relocateHouseholds(s, op.areaId, op.batch ?? 20); break;
        case "threshold": s = setLandslideThreshold(s, op.value); break;
        case "budget":    s = setContainmentBudget(s, op.value); break;
        case "evacuate":  s = crisisEvacuate(s); break;
        case "shelter":   s = crisisOpenShelter(s); break;
        case "donations": s = crisisCoordinateDonations(s); break;
      }
      return s;
    }
    case "massEvent": {
      let s = structuredClone(state);
      const op = action.op;
      switch (op.kind) {
        case "setPosture":       s = setMevPosture(s, op.activity, op.posture); break;
        case "setSecurityRatio": s = setMevSecurityRatio(s, op.value); break;
        case "setCultureBudget": s = setMevCultureBudget(s, op.value); break;
        case "fundSpot":         s = fundCulturalSpot(s); break;
        case "resolveDilemma":   s = resolveMevDilemma(s, op.choiceIdx); break;
      }
      return s;
    }
    case "oversight": {
      const op = action.op;
      switch (op.kind) {
        case "payMp":          return payMpSettlement(state);
        case "contestTce":     return contestTceRuling(state);
        case "resumeWork":     return resumeStalledWork(state, op.workId);
        case "defendMandate":  return defendMandate(state);
      }
      return state;
    }
    case "landConflict": {
      const op = action.op;
      switch (op.kind) {
        case "negotiate": return negotiateOccupation(state, op.id);
        case "evict":     return evictOccupation(state, op.id);
      }
      return state;
    }
    case "media": {
      if (action.op.kind === "briefing") return officialBriefing(state);
      return state;
    }
    case "policeShow": {
      if (action.op.kind === "dispatch") return dispatchPoliceUnits(state);
      return state;
    }
    case "zapzap": {
      const op = action.op;
      if (op.kind === "setBudget") return setCommsBudget(state, op.value);
      if (op.kind === "debunk")    return debunkMessage(state, op.id);
      if (op.kind === "markRead")  return markChatRead(state);
      return state;
    }
    case "negotiation": {
      const op = action.op;
      if (op.kind === "emenda") {
        const r = offerEmenda(state, op.billId, op.vereadorId, op.amount);
        return r.state;
      }
      if (op.kind === "cedeMinistry") {
        const r = cedeMinistry(state, op.ministry, op.party);
        return r.state;
      }
      if (op.kind === "revokeMinistry") return revokeMinistry(state, op.ministry);
      if (op.kind === "investigateCPI") return investigateCPI(state);
      return state;
    }
    case "electionCampaign": {
      const op = action.op;
      if (op.kind === "acceptCoalition") return acceptCoalition(state, op.id);
      if (op.kind === "rejectCoalition") return rejectCoalition(state, op.id);
      if (op.kind === "promise")         return makePromise(state, op.topic);
      if (op.kind === "setTv")           return setMayorTv(state, op.share);
      if (op.kind === "startDebate")     return startDebate(state, op.topic);
      if (op.kind === "debate")          return mayorDebateResponse(state, op.strategy);
      return state;
    }
    case "inbox": {
      const op = action.op;
      if (op.kind === "decide")   return decideEmail(state, op.id, op.decision);
      if (op.kind === "markRead") return markInboxRead(state);
      return state;
    }
    case "piupiu": {
      const op = action.op;
      if (op.kind === "respond") return piupiuRespond(state, op.triggerId, op.response);
      if (op.kind === "markRead") return piupiuMarkRead(state);
      return state;
    }
    case "covertOps": {
      const op = action.op;
      const s = { ...state };
      if (op.kind === "hireAgency")     return coHire(s, op.agency);
      if (op.kind === "fireAgency")     return coFire(s, op.agency);
      if (op.kind === "launchBot")      return coLaunchBot(s, op.agency, op.tactic, op.monthlyBudget, op.target);
      if (op.kind === "cancelBot")      return coCancelBot(s, op.opId);
      if (op.kind === "hireInfluencer") return coHireInflu(s, op.agency, op.campaign);
      return state;
    }
    case "cascade": {
      const s = { ...state };
      if (action.op.kind === "tow")    return decideTowAndOwn(s);
      if (action.op.kind === "bot")    return decideBotFarm(s);
      if (action.op.kind === "ignore") return decideIgnore(s, seededRng(s.seed, s));
      return state;
    }
    case "advisor": {
      const s = structuredClone(state);
      const op = action.op;
      switch (op.kind) {
        case "hire":    hireAdvisor(s, op.candidateId, op.portfolio); break;
        case "fire":    fireAdvisor(s, op.portfolio); break;
        case "train":   trainAdvisor(s, op.portfolio); break;
        case "retain":  retainAdvisor(s, op.portfolio); break;
        case "release": releasePoached(s, op.portfolio); break;
      }
      return s;
    }
    case "corruption": {
      const s = structuredClone(state);
      const op = action.op;
      switch (op.kind) {
        case "ghost":       return createGhost(s, op.portfolio);
        case "removeGhost": return removeGhost(s, op.id);
        case "shell":       return launchShell(s, op.portfolio, op.baseValue, op.overpricePct);
        case "bribe":       return bribeCouncil(s, op.amount);
        case "fundBots":    return fundBotsFromSlush(s, op.amount);
        case "plea": {
          resolveDelacao(s, op.choice);
          return s;
        }
        case "dismissPlea": return dismissPlea(s);
      }
      return s;
    }
    case "bidding": {
      const s = structuredClone(state);
      const op = action.op;
      if (op.kind === "open")   openBiddingForCategory(s, op.category, op.district);
      if (op.kind === "award")  awardPublicBidding(s, op.bidId, op.proposalId);
      if (op.kind === "cancel") cancelPublicBidding(s, op.bidId);
      return s;
    }
    case "useSecondChance": {
      const sc = state.secondChance;
      if (!sc?.snapshot || sc.used) return state;
      const restored = structuredClone(sc.snapshot) as GameState;
      restored.secondChance = {
        snapshot: null,
        snapshotAt: sc.snapshotAt,
        electionYear: sc.electionYear,
        used: true,
      };
      // Push a news item explaining the rewind.
      restored.news = restored.news ?? [];
      restored.news.unshift({
        id: `konami-rewind-${restored.year}-${restored.month}`,
        kind: "success",
        titleKey: restored.lang === "pt"
          ? "Segunda chance concedida — 1 ano antes da eleição perdida||Second chance granted — 1 year before the lost election"
          : "Second chance granted — 1 year before the lost election||Segunda chance concedida — 1 ano antes da eleição perdida",
        month: restored.month, year: restored.year, day: restored.day,
      });
      restored.speed = 0;
      return restored;
    }
    case "hydrate":
      return action.state;

    default:
      return state;
  }
}


function loadFromStorage(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function useGame() {
  // IMPORTANTE: use um seed FIXO no initializer. `initialState()` chama
  // `randomSeed()` quando nenhum seed é passado, o que gera valores diferentes
  // entre SSR e client (`Math.random()`) e provoca "Hydration failed".
  // Este estado é apenas placeholder — assim que o jogador escolhe cidade em
  // CityPicker, `newGame` dispatcha um estado com o seed real dele.
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(undefined, { seed: "SSR-PLACEHOLDER" }));
  const [showStart, setShowStart] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [initialMode, setInitialMode] = useState<"sandbox" | "mayor">("mayor");
  const [savedGame, setSavedGame] = useState<GameState | null>(null);
  const [pendingStart, setPendingStart] = useState<
    { presetId?: string; cityName: string; seed: string; lang: Lang; scaleId?: string; scenarioId?: string; sandbox?: import("@/game/scenarios").SandboxOverrides; growthMode?: boolean; mode?: "sandbox" | "mayor"; difficulty?: import("@/game/difficulty").DifficultyLevel } | null
  >(null);
  // After the mayor is created we hold the full setup here until the player
  // finishes the cabinet-selection screen (or skips it).
  const [pendingCabinet, setPendingCabinet] = useState<
    (NonNullable<typeof pendingStart> & { mayor: Mayor }) | null
  >(null);
  const hydratedRef = useRef(false);

  // On mount: check for a saved game, but always show the Start screen first so
  // the player can pick "Continue" or start a new run in Mayor / Sandbox mode.
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      if (!saved.mayor) saved.mayor = DEFAULT_MAYOR;
      ensureZoning(saved);
      setSavedGame(saved);
    }
    setShowStart(true);
    hydratedRef.current = true;
  }, []);


  // Persist on change — debounced off the hot path. Previously ran a full
  // JSON.stringify(state) every tick (every 100–400 ms), which caused frame
  // drops on large maps. Now coalesced into a single idle callback ~1.5 s
  // after the last change, with an eager flush on tab hide / unload.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (!hydratedRef.current || showStart || showPicker || pendingStart) return;
    let handle: number | undefined;
    const flush = () => {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current)); }
      catch { /* ignore quota errors */ }
    };
    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    handle = win.requestIdleCallback
      ? win.requestIdleCallback(() => { handle = undefined; flush(); }, { timeout: 2000 })
      : window.setTimeout(() => { handle = undefined; flush(); }, 1500);
    const onHide = () => flush();
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      if (handle !== undefined) {
        if (win.cancelIdleCallback) win.cancelIdleCallback(handle);
        else window.clearTimeout(handle);
      }
    };
  }, [state, showStart, showPicker, pendingStart]);

  // Tick loop — interval based on speed
  useEffect(() => {
    if (showStart || showPicker || pendingStart || state.speed === 0 || state.activeEvent) return;
    const ms = state.speed === 1 ? 900 : state.speed === 2 ? 450 : 220;
    const id = window.setInterval(() => dispatch({ type: "tick" }), ms);
    return () => window.clearInterval(id);
  }, [state.speed, state.activeEvent, showStart, showPicker, pendingStart]);



  const actions = {
    setSpeed: useCallback((speed: GameState["speed"]) => dispatch({ type: "setSpeed", speed }), []),
    setLang: useCallback((lang: Lang) => dispatch({ type: "setLang", lang }), []),
    setCityName: useCallback((name: string) => dispatch({ type: "setCityName", name }), []),
    setPolicy: useCallback(
      (key: PolicyKey, value: number) => dispatch({ type: "policy", key, value }),
      [],
    ),
    setSustainability: useCallback(
      (key: SustainabilityKey, value: number) =>
        dispatch({ type: "sustainability", key, value }),
      [],
    ),
    setTax: useCallback(
      (key: TaxKey, value: number) => dispatch({ type: "tax", key, value }),
      [],
    ),
    expandWater: useCallback(() => dispatch({ type: "expandWater" }), []),
    expandEnergy: useCallback(() => dispatch({ type: "expandEnergy" }), []),
    takeLoan: useCallback(() => dispatch({ type: "loan" }), []),
    payDebt: useCallback(() => dispatch({ type: "payDebt" }), []),
    resolveEvent: useCallback(
      (choice: number) => {
        const evt = stateRef.current.activeEvent;
        const c = evt?.def.choices[choice];
        const lean = c?.ideologyLean;
        if (typeof lean === "number") {
          const ideo = __findPolitician(stateRef.current.mayor.personaId ?? "")?.ideology ?? 0;
          const matched = 1 - Math.abs(ideo - lean) / 2;
          const lang = stateRef.current.lang;
          const name = stateRef.current.mayor.name || (lang === "pt" ? "prefeito(a)" : "mayor");
          if (matched >= 0.6) __toast.success(lang === "pt" ? `Escolha coerente com ${name}` : `Choice consistent with ${name}`);
          else if (matched <= 0.35) __toast.warning(lang === "pt" ? "Escolha destoa da linha ideológica" : "Choice diverges from party line");
        }
        dispatch({ type: "resolveEvent", choice });
      },
      [],
    ),
    endCareerAndPick: useCallback(
      (reason: "victory" | "defeated" | "impeached") => {
        __saveCareerToHall(stateRef.current, reason);
        // Clear end-of-career flags so returning to this state doesn't
        // re-open LegacyScreen/ElectionModal/ImpeachmentGameOver.
        dispatch({ type: "clearEndOfCareer" });
        setShowPicker(true);
      },
      [],
    ),
    reset: useCallback((seed?: string) => dispatch({ type: "reset", seed }), []),
    tutorialSetStep: useCallback(
      (step: number) => dispatch({ type: "tutorialSetStep", step }),
      [],
    ),

    setSeed: useCallback((seed: string) => dispatch({ type: "setSeed", seed }), []),
    setMayor: useCallback((mayor: Mayor) => dispatch({ type: "setMayor", mayor }), []),
    paintTile: useCallback(
      (x: number, y: number, tool: ZoneTool) => dispatch({ type: "paint", x, y, tool }),
      [],
    ),
    paintRoad: useCallback(
      (x: number, y: number, tool: RoadTool) => dispatch({ type: "paintRoad", x, y, tool }),
      [],
    ),
    build: useCallback(
      (x: number, y: number, kind: StateBuildKind) => dispatch({ type: "build", x, y, kind }),
      [],
    ),
    urbanizeFavela: useCallback(() => dispatch({ type: "urbanize" }), []),
    inviteParty: useCallback((id: PartyId) => dispatch({ type: "coalitionJoin", id }), []),
    ejectParty: useCallback((id: PartyId) => dispatch({ type: "coalitionLeave", id }), []),
    partyDemand: {
      accept:  () => dispatch({ type: "partyDemand", op: { kind: "respond", response: "accept" } }),
      decline: () => dispatch({ type: "partyDemand", op: { kind: "respond", response: "decline" } }),
    },
    signSisterCity: useCallback(() => dispatch({ type: "sisterCity" }), []),
    applyGrant: useCallback(() => dispatch({ type: "multilateralGrant" }), []),
    requestTransfer: useCallback(
      (kind: TransferKind) => dispatch({ type: "requestTransfer", kind }),
      [],
    ),
    respondGroup: useCallback(
      (id: GroupId, mode: "concede" | "confront") =>
        dispatch({ type: "respondGroup", id, mode }),
      [],
    ),
    campaign: useCallback((amount: number) => dispatch({ type: "campaign", amount }), []),
    acknowledgeElection: useCallback(() => dispatch({ type: "ackElection" }), []),
    setLandPolicy: useCallback(
      (patch: Partial<GameState["landPolicy"]>) => dispatch({ type: "landPolicy", patch }),
      [],
    ),
    setInformalPolicy: (patch: Partial<InformalPolicy>) => dispatch({ type: "informal", patch }),
    bill: {
      propose:  (templateId: string) => dispatch({ type: "bill", op: { kind: "propose", templateId } }),
      boost:    (billId: string, spend: number) => dispatch({ type: "bill", op: { kind: "boost", billId, spend } }),
      vote:     (billId: string) => dispatch({ type: "bill", op: { kind: "vote", billId } }),
      withdraw: (billId: string) => dispatch({ type: "bill", op: { kind: "withdraw", billId } }),
    },
    transport: {
      openBidding:  () => dispatch({ type: "transport", op: { kind: "openBidding" } }),
      awardBid:     (bidId: string) => dispatch({ type: "transport", op: { kind: "awardBid", bidId } }),
      cancelBidding:() => dispatch({ type: "transport", op: { kind: "cancelBidding" } }),
      setFare:      (mode: TransportModeId, value: number) => dispatch({ type: "transport", op: { kind: "setFare", mode, value } }),
      setSubsidy:   (mode: TransportModeId, value: number) => dispatch({ type: "transport", op: { kind: "setSubsidy", mode, value } }),
      buildBrt:     () => dispatch({ type: "transport", op: { kind: "buildBrt" } }),
      buildMetro:   () => dispatch({ type: "transport", op: { kind: "buildMetro" } }),
      setCrackdown: (value: number) => dispatch({ type: "transport", op: { kind: "setCrackdown", value } }),
      legalizeInformal: () => dispatch({ type: "transport", op: { kind: "legalizeInformal" } }),
      buildCycleway: () => dispatch({ type: "transport", op: { kind: "buildCycleway" } }),
      setFuelPrice: (value: number) => dispatch({ type: "transport", op: { kind: "setFuelPrice", value } }),
      setFareModel: (model: FareModel) => dispatch({ type: "transport", op: { kind: "setFareModel", model } }),
      toggleIntegration: () => dispatch({ type: "transport", op: { kind: "toggleIntegration" } }),
      setTransferWindow: (value: number) => dispatch({ type: "transport", op: { kind: "setTransferWindow", value } }),
      setCorporateMobilityTax: (value: number) => dispatch({ type: "transport", op: { kind: "setCorporateMobilityTax", value } }),
      setVehicleMobilityFee: (value: number) => dispatch({ type: "transport", op: { kind: "setVehicleMobilityFee", value } }),
      setElectrifyInvestment: (value: number) => dispatch({ type: "transport", op: { kind: "setElectrifyInvestment", value } }),
      toggleRequireElectricBids: () => dispatch({ type: "transport", op: { kind: "toggleRequireElectricBids" } }),
      expandRoadway: () => dispatch({ type: "transport", op: { kind: "expandRoadway" } }),
      buildCalmingZone: () => dispatch({ type: "transport", op: { kind: "buildCalmingZone" } }),
      toggleReversibleLanes: () => dispatch({ type: "transport", op: { kind: "toggleReversibleLanes" } }),
      toggleSmartSignals: () => dispatch({ type: "transport", op: { kind: "toggleSmartSignals" } }),
      setPaidParkingCoverage: (value: number) => dispatch({ type: "transport", op: { kind: "setPaidParkingCoverage", value } }),
      setParkingFee: (value: number) => dispatch({ type: "transport", op: { kind: "setParkingFee", value } }),
    },
    climate: {
      buildDrainage:    () => dispatch({ type: "climate", op: { kind: "buildDrainage" } }),
      buildPiscinao:    () => dispatch({ type: "climate", op: { kind: "buildPiscinao" } }),
      setSanModel:      (model: SanitationModel) => dispatch({ type: "climate", op: { kind: "setSanModel", model } }),
      setSanInvestment: (value: number) => dispatch({ type: "climate", op: { kind: "setSanInvestment", value } }),
      setSanTariff:     (value: number) => dispatch({ type: "climate", op: { kind: "setSanTariff", value } }),
      setWasteMode:     (mode: WasteMode) => dispatch({ type: "climate", op: { kind: "setWasteMode", mode } }),
      fundCooperative:  () => dispatch({ type: "climate", op: { kind: "fundCooperative" } }),
      setPipeReplacement: (value: number) => dispatch({ type: "climate", op: { kind: "setPipeReplacement", value } }),

    },
    housing: {
      setPolicy: (patch: Partial<HousingPolicy>) => dispatch({ type: "housing", patch }),
    },
    education: {
      setTeacherSalary:  (value: number) => dispatch({ type: "education", op: { kind: "teacherSalary", value } }),
      setSchoolTransport:(value: number) => dispatch({ type: "education", op: { kind: "schoolTransport", value } }),
      fundTechCenter:    () => dispatch({ type: "education", op: { kind: "fundTechCenter" } }),
      closeTechCenter:   () => dispatch({ type: "education", op: { kind: "closeTechCenter" } }),
    },
    parallel: {
      setDoctrine: (doctrine: EnforcementDoctrine) =>
        dispatch({ type: "parallel", op: { kind: "setDoctrine", doctrine } }),
      setSocialInvestment: (value: number) =>
        dispatch({ type: "parallel", op: { kind: "setSocialInvestment", value } }),
      runOperation: () => dispatch({ type: "parallel", op: { kind: "runOperation" } }),
    },
    disaster: {
      invest:    (areaId: string) => dispatch({ type: "disaster", op: { kind: "invest", areaId } }),
      relocate:  (areaId: string, batch?: number) =>
        dispatch({ type: "disaster", op: { kind: "relocate", areaId, batch } }),
      threshold: (value: number) => dispatch({ type: "disaster", op: { kind: "threshold", value } }),
      budget:    (value: number) => dispatch({ type: "disaster", op: { kind: "budget", value } }),
      evacuate:  () => dispatch({ type: "disaster", op: { kind: "evacuate" } }),
      shelter:   () => dispatch({ type: "disaster", op: { kind: "shelter" } }),
      donations: () => dispatch({ type: "disaster", op: { kind: "donations" } }),
    },
    oversight: {
      payMp:         () => dispatch({ type: "oversight", op: { kind: "payMp" } }),
      contestTce:    () => dispatch({ type: "oversight", op: { kind: "contestTce" } }),
      resumeWork:    (workId: string) =>
        dispatch({ type: "oversight", op: { kind: "resumeWork", workId } }),
      defendMandate: () => dispatch({ type: "oversight", op: { kind: "defendMandate" } }),
    },
    landConflict: {
      negotiate: (id: string) => dispatch({ type: "landConflict", op: { kind: "negotiate", id } }),
      evict:     (id: string) => dispatch({ type: "landConflict", op: { kind: "evict", id } }),
    },
    media: {
      briefing: () => dispatch({ type: "media", op: { kind: "briefing" } }),
    },
    policeShow: {
      dispatchUnits: () => dispatch({ type: "policeShow", op: { kind: "dispatch" } }),
    },
    zapzap: {
      setBudget: (value: number) => dispatch({ type: "zapzap", op: { kind: "setBudget", value } }),
      debunk:    (id: string)    => dispatch({ type: "zapzap", op: { kind: "debunk", id } }),
      markRead:  ()              => dispatch({ type: "zapzap", op: { kind: "markRead" } }),
    },
    negotiation: {
      emenda: (billId: string, vereadorId: string, amount: number) =>
        dispatch({ type: "negotiation", op: { kind: "emenda", billId, vereadorId, amount } }),
      cedeMinistry: (ministry: MinistryId, party: PartyId) =>
        dispatch({ type: "negotiation", op: { kind: "cedeMinistry", ministry, party } }),
      revokeMinistry: (ministry: MinistryId) =>
        dispatch({ type: "negotiation", op: { kind: "revokeMinistry", ministry } }),
      investigateCPI: () =>
        dispatch({ type: "negotiation", op: { kind: "investigateCPI" } }),
    },
    electionCampaign: {
      acceptCoalition: (id: string) => dispatch({ type: "electionCampaign", op: { kind: "acceptCoalition", id } }),
      rejectCoalition: (id: string) => dispatch({ type: "electionCampaign", op: { kind: "rejectCoalition", id } }),
      promise: (topic: DebateTopic) => dispatch({ type: "electionCampaign", op: { kind: "promise", topic } }),
      setTv:   (share: number)      => dispatch({ type: "electionCampaign", op: { kind: "setTv", share } }),
      startDebate: (topic: DebateTopic) => dispatch({ type: "electionCampaign", op: { kind: "startDebate", topic } }),
      debate:  (strategy: DebateStrategy) => dispatch({ type: "electionCampaign", op: { kind: "debate", strategy } }),
    },
    inbox: {
      decide: (id: string, decision: InboxDecision) =>
        dispatch({ type: "inbox", op: { kind: "decide", id, decision } }),
      markRead: () => dispatch({ type: "inbox", op: { kind: "markRead" } }),
    },
    piupiu: {
      respond: (triggerId: string, response: "official_note" | "humor" | "field_team") =>
        dispatch({ type: "piupiu", op: { kind: "respond", triggerId, response } }),
      markRead: () => dispatch({ type: "piupiu", op: { kind: "markRead" } }),
    },
    cascade: {
      tow:    () => dispatch({ type: "cascade", op: { kind: "tow" } }),
      bot:    () => dispatch({ type: "cascade", op: { kind: "bot" } }),
      ignore: () => dispatch({ type: "cascade", op: { kind: "ignore" } }),
    },
    advisor: {
      hire:    (candidateId: string, portfolio: PortfolioId) =>
        dispatch({ type: "advisor", op: { kind: "hire", candidateId, portfolio } }),
      fire:    (portfolio: PortfolioId) => dispatch({ type: "advisor", op: { kind: "fire", portfolio } }),
      train:   (portfolio: PortfolioId) => dispatch({ type: "advisor", op: { kind: "train", portfolio } }),
      retain:  (portfolio: PortfolioId) => dispatch({ type: "advisor", op: { kind: "retain", portfolio } }),
      release: (portfolio: PortfolioId) => dispatch({ type: "advisor", op: { kind: "release", portfolio } }),
    },
    corruption: {
      ghost:       (portfolio: PortfolioId) => dispatch({ type: "corruption", op: { kind: "ghost", portfolio } }),
      removeGhost: (id: string) => dispatch({ type: "corruption", op: { kind: "removeGhost", id } }),
      shell:       (portfolio: PortfolioId, baseValue: number, overpricePct: number) =>
        dispatch({ type: "corruption", op: { kind: "shell", portfolio, baseValue, overpricePct } }),
      bribe:       (amount: number) => dispatch({ type: "corruption", op: { kind: "bribe", amount } }),
      fundBots:    (amount: number) => dispatch({ type: "corruption", op: { kind: "fundBots", amount } }),
      resolvePlea: (choice: PleaChoice) => dispatch({ type: "corruption", op: { kind: "plea", choice } }),
      dismissPlea: () => dispatch({ type: "corruption", op: { kind: "dismissPlea" } }),
    },
    covertOps: {
      hire:   (agency: AgencyId) => dispatch({ type: "covertOps", op: { kind: "hireAgency", agency } }),
      fire:   (agency: AgencyId) => dispatch({ type: "covertOps", op: { kind: "fireAgency", agency } }),
      launchBot: (agency: AgencyId, tactic: BotTactic, monthlyBudget: number, target?: string) =>
        dispatch({ type: "covertOps", op: { kind: "launchBot", agency, tactic, monthlyBudget, target } }),
      cancelBot: (opId: string) => dispatch({ type: "covertOps", op: { kind: "cancelBot", opId } }),
      hireInfluencer: (agency: AgencyId, campaign: InfluencerCampaign) =>
        dispatch({ type: "covertOps", op: { kind: "hireInfluencer", agency, campaign } }),
    },
    massEvent: {
      setPosture: (activity: ActivityKey, posture: Posture) =>
        dispatch({ type: "massEvent", op: { kind: "setPosture", activity, posture } }),
      setSecurityRatio: (value: number) =>
        dispatch({ type: "massEvent", op: { kind: "setSecurityRatio", value } }),
      setCultureBudget: (value: number) =>
        dispatch({ type: "massEvent", op: { kind: "setCultureBudget", value } }),
      fundSpot: () => dispatch({ type: "massEvent", op: { kind: "fundSpot" } }),
      resolveDilemma: (choiceIdx: number) =>
        dispatch({ type: "massEvent", op: { kind: "resolveDilemma", choiceIdx } }),
    },
    bidding: {
      open:   (category: import("@/game/bidding").WorkCategory, district: import("@/game/districts").DistrictKind) =>
        dispatch({ type: "bidding", op: { kind: "open", category, district } }),
      award:  (bidId: string, proposalId: string) =>
        dispatch({ type: "bidding", op: { kind: "award", bidId, proposalId } }),
      cancel: (bidId: string) =>
        dispatch({ type: "bidding", op: { kind: "cancel", bidId } }),
    },
    useSecondChance: useCallback(() => dispatch({ type: "useSecondChance" }), []),
    openPicker: useCallback(() => setShowPicker(true), []),
    closePicker: useCallback(() => {
      setShowPicker(false);
      setPendingStart(null);
    }, []),
    // Start-screen controls.
    openStart: useCallback(() => {
      setShowStart(true);
      setShowPicker(false);
      setPendingStart(null);
    }, []),
    continueGame: useCallback(() => {
      if (savedGame) dispatch({ type: "hydrate", state: savedGame });
      setShowStart(false);
    }, [savedGame]),
    newGame: useCallback((mode: "sandbox" | "mayor") => {
      setInitialMode(mode);
      setShowStart(false);
      setShowPicker(true);
    }, []),
    backToStart: useCallback(() => {
      setShowPicker(false);
      setPendingStart(null);
      setShowStart(true);
    }, []),
    // Step 1: player finished the city picker → move to mayor creator.
    chooseCity: useCallback(
      (opts: { presetId?: string; cityName: string; seed: string; lang?: Lang; scaleId?: string; scenarioId?: string; sandbox?: import("@/game/scenarios").SandboxOverrides; growthMode?: boolean; mode?: "sandbox" | "mayor"; difficulty?: import("@/game/difficulty").DifficultyLevel }) => {
        setPendingStart({
          presetId: opts.presetId,
          cityName: opts.cityName,
          seed: opts.seed,
          lang: opts.lang ?? "pt",
          scaleId: opts.scaleId,
          scenarioId: opts.scenarioId,
          sandbox: opts.sandbox,
          growthMode: opts.growthMode,
          mode: opts.mode,
          difficulty: opts.difficulty,
        });
        setShowPicker(false);
      },
      [],
    ),
    cancelMayorSetup: useCallback(() => {
      setPendingStart(null);
      setShowPicker(true);
    }, []),
    // Step 2: player finished the mayor creator → advance to the cabinet setup.
    startGame: useCallback(
      (mayor: Mayor) => {
        if (!pendingStart) return;
        setPendingCabinet({ ...pendingStart, mayor });
      },
      [pendingStart],
    ),
    // Step 3: cabinet chosen → boot the game with mayor + initial cabinet.
    confirmCabinet: useCallback(
      (picks: Partial<Record<PortfolioId, Advisor>>) => {
        if (!pendingCabinet) return;
        dispatch({
          type: "startGame",
          presetId: pendingCabinet.presetId,
          cityName: pendingCabinet.cityName,
          seed: pendingCabinet.seed,
          lang: pendingCabinet.lang,
          mayor: pendingCabinet.mayor,
          scaleId: pendingCabinet.scaleId,
          scenarioId: pendingCabinet.scenarioId,
          sandbox: pendingCabinet.sandbox,
          growthMode: pendingCabinet.growthMode,
          mode: pendingCabinet.mode,
          difficulty: pendingCabinet.difficulty,
          initialCabinet: picks,
        });
        setPendingCabinet(null);
        setPendingStart(null);
      },
      [pendingCabinet],
    ),
    // Voltar do gabinete para o criador de prefeito.
    cancelCabinetSetup: useCallback(() => {
      setPendingCabinet(null);
    }, []),
  };

  return { state, actions, showStart, showPicker, pendingStart, pendingCabinet, initialMode, hasSave: !!savedGame };
}


