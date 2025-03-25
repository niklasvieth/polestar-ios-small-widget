// icon-color: green; icon-glyph: battery-half;

/**
 * This widget has been developed by Niklas Vieth.
 * Installation and configuration details can be found at https://github.com/niklasvieth/polestar-ios-small-widget
 */

// Mandatory Config
const POLESTAR_EMAIL = "EMAIL";
const POLESTAR_PASSWORD = "PASSWORD";
// Optional (only necessary if more than one car linked to account)
let VIN;
// let VIN = "VIN";
let VEHICLE_NAME;
// let VEHICLE_NAME = "Polestar Custom Name";

// Additional optional configuration
const IMAGE_ANGLE = "5"; // Possible values 0,1,2,3,4,5
const RANGE_IN_MILES = false; // true
const LAST_SEEN_RELATIVE_DATE = false; // true
const MIN_SOC_GREEN = 60;
const MIN_SOC_ORANGE = 30;

const DARK_MODE = Device.isUsingDarkAppearance(); // or set manually to (true or false)
const DARK_BG_COLOR = "000000";
const LIGHT_BG_COLOR = "FFFFFF";

// API config
const POLESTAR_BASE_URL = "https://pc-api.polestar.com/eu-north-1";
const POLESTAR_API_URL_V2 = `${POLESTAR_BASE_URL}/mystar-v2`;
const POLESTAR_API_URL = `${POLESTAR_BASE_URL}/my-star`;
const POLESTAR_REDIRECT_URI = "https://www.polestar.com/sign-in-callback";
const POLESTAR_ICON = "https://www.polestar.com/w3-assets/coast-228x228.png";
const CLIENT_ID = "l3oopkc_10";
const CODE_VERIFIER = "polestar-ios-widgets-are-enabled-by-scriptable";
const CODE_CHALLENGE = "adYJTSAVqq6CWBJn7yNdGKwcsmJb8eBewG8WpxnUzaE";

// Check that params are set
if (POLESTAR_EMAIL === "EMAIL") {
  throw new Error("POLESTAR_EMAIL is not configured");
}
if (POLESTAR_PASSWORD === "PASSWORD") {
  throw new Error("POLESTAR_PASSWORD is not configured");
}
if (VIN === "VIN") {
  throw new Error("VIN is not configured");
}

// Create Widget
const accessToken = await getAccessToken();
const vehicleData = await getVehicles(accessToken);
const telematicData = await getTelematics(accessToken);
const batteryData = telematicData.carTelematics.battery;
const odometerData = telematicData.carTelematics.odometer;

// You can run the script in the app to preview the widget or you can go to the Home Screen, add a new Scriptable widget and configure the widget to run this script.
// You can also try creating a shortcut that runs this script. Running the shortcut will show widget.
const widget = await createPolestarWidget(
  batteryData,
  odometerData,
  vehicleData
);
if (config.runsInWidget) {
  // The script runs inside a widget, so we pass our instance of ListWidget to be shown inside the widget on the Home Screen.
  Script.setWidget(widget);
} else {
  // The script runs inside the app, so we preview the widget.
  widget.presentSmall();
}

// Calling Script.complete() signals to Scriptable that the script have finished running.
// This can speed up the execution, in particular when running the script from Shortcuts or using Siri.
Script.complete();

// Create polestar widget
async function createPolestarWidget(batteryData, odometerData, vehicle) {
  const batteryPercent = parseInt(batteryData.batteryChargeLevelPercentage);
  const isCharging = batteryData.chargingStatus === "CHARGING_STATUS_CHARGING";
  const remainingChargingTime = batteryData.estimatedChargingTimeToFullMinutes;
  const rangeKm = batteryData.estimatedDistanceToEmptyKm;
  const rangeMiles = batteryData.estimatedDistanceToEmptyMiles;
  const isChargingDone = batteryData.chargingStatus === "CHARGING_STATUS_DONE";
  const isConnected =
    batteryData.chargerConnectionStatus ===
    "CHARGER_CONNECTION_STATUS_CONNECTED";
  const chargingAmps = batteryData.chargingCurrentAmps ?? 0;
  const chargingWatts = batteryData.chargingPowerWatts ?? 0;
  const chargingKw = parseInt(chargingWatts / 1000);

  // Prepare image
  if (!vehicle.content.images.studio.angles.includes(IMAGE_ANGLE)) {
    throw new Error(
      `IMG_ANGLE ${IMAGE_ANGLE} is not in ${vehicle.content.images.studio.angles}`
    );
  }
  const imgUrl = `${
    vehicle.content.images.studio.url
  }&angle=${IMAGE_ANGLE}&bg=${
    DARK_MODE ? DARK_BG_COLOR : LIGHT_BG_COLOR
  }&width=600`;

  const appIcon = await loadImage(POLESTAR_ICON);
  const title = VEHICLE_NAME ?? vehicle.content.model.name;
  const widget = new ListWidget();
  widget.url = "polestar-explore://";
  const mainStack = widget.addStack();
  mainStack.layoutVertically();

  // Add background color
  widget.backgroundColor = DARK_MODE
    ? new Color(DARK_BG_COLOR)
    : new Color(LIGHT_BG_COLOR);

  // Show app icon and title
  mainStack.addSpacer();
  const titleStack = mainStack.addStack();
  const titleElement = titleStack.addText(title);
  titleElement.textColor = DARK_MODE ? Color.white() : Color.black();
  titleElement.textOpacity = 0.7;
  titleElement.font = Font.mediumSystemFont(14);
  titleStack.addSpacer();
  const appIconElement = titleStack.addImage(appIcon);
  appIconElement.imageSize = new Size(18, 18);
  appIconElement.cornerRadius = 4;
  mainStack.addSpacer();

  // Battery Info
  const batteryInfoStack = mainStack.addStack();
  batteryInfoStack.layoutVertically();

  // Battery Percent Value
  const batteryPercentStack = batteryInfoStack.addStack();
  batteryPercentStack.centerAlignContent();
  const { batteryIcon, batteryIconColor } = getBatteryIcon(
    batteryPercent,
    isConnected,
    isCharging,
    isChargingDone
  );
  const batterySymbolElement = batteryPercentStack.addImage(batteryIcon.image);
  batterySymbolElement.imageSize = new Size(15, 15);
  batterySymbolElement.tintColor = batteryIconColor;
  batteryPercentStack.addSpacer(4);

  const batteryPercentText = batteryPercentStack.addText(`${batteryPercent} %`);
  batteryPercentText.textColor = getBatteryPercentColor(batteryPercent);
  batteryPercentText.font = Font.boldSystemFont(14);
  batteryPercentStack.addSpacer();

  // Range
  const rangeText = RANGE_IN_MILES ? `${rangeMiles} mi` : `${rangeKm} km`;
  const rangeElement = batteryPercentStack.addText(rangeText);
  rangeElement.font = Font.mediumSystemFont(12);
  rangeElement.textColor = DARK_MODE ? Color.white() : Color.black();
  rangeElement.rightAlignText();

  if (isCharging) {
    batteryInfoStack.addSpacer(2);
    const batteryChargingTimeStack = batteryInfoStack.addStack();
    const remainingChargeTimeHours = parseInt(remainingChargingTime / 60);
    const remainingChargeTimeMinsRemainder = remainingChargingTime % 60;
    const chargingTimeElement = batteryChargingTimeStack.addText(
      `${chargingKw} kW  -  ${remainingChargeTimeHours}h ${remainingChargeTimeMinsRemainder}m`
    );
    chargingTimeElement.font = Font.mediumSystemFont(10);
    chargingTimeElement.textOpacity = 0.9;
    chargingTimeElement.textColor = DARK_MODE ? Color.white() : Color.black();
    chargingTimeElement.rightAlignText();
  }
  mainStack.addSpacer();

  // Image
  const imageStack = mainStack.addStack();
  imageStack.addSpacer();
  const carImage = await loadImage(imgUrl);
  const carImageElement = imageStack.addImage(carImage);
  carImageElement.imageSize = new Size(100, 50);
  imageStack.addSpacer();
  mainStack.addSpacer(4);

  // Add odometer
  const odometerText = RANGE_IN_MILES
    ? `${parseInt(odometerData.odometerMeters / 1609.344).toLocaleString()} mi`
    : `${parseInt(odometerData.odometerMeters / 1000).toLocaleString()} km`;
  const odometerElement = mainStack.addText(odometerText);
  odometerElement.font = Font.mediumSystemFont(10);
  odometerElement.textColor = DARK_MODE ? Color.white() : Color.black();
  odometerElement.textOpacity = 0.7;
  mainStack.addSpacer(2);

  // Add last seen indicator
  const footerStack = mainStack.addStack();
  footerStack.addSpacer();
  const lastSeenDate = new Date(batteryData.eventUpdatedTimestamp.iso);
  const lastSeenText = lastSeenDate.toLocaleString();
  let lastSeenElement;
  if (LAST_SEEN_RELATIVE_DATE) {
    lastSeenElement = footerStack.addDate(lastSeenDate);
    lastSeenElement.applyRelativeStyle();
  } else {
    lastSeenElement = footerStack.addText(lastSeenText);
  }
  lastSeenElement.font = Font.mediumSystemFont(10);
  lastSeenElement.textOpacity = 0.5;
  lastSeenElement.textColor = DARK_MODE ? Color.white() : Color.black();
  lastSeenElement.minimumScaleFactor = 0.7;

  return widget;
}

/**********************
 * Polestar API helpers
 **********************/
async function getAccessToken() {
  const { pathToken, cookie } = await getLoginFlowTokens();
  const tokenRequestCode = await performLogin(pathToken, cookie);
  const apiCreds = await getApiToken(tokenRequestCode);
  return apiCreds.access_token;
}

async function performLogin(pathToken, cookie) {
  const req = new Request(
    `https://polestarid.eu.polestar.com/as/${pathToken}/resume/as/authorization.ping?client_id=${CLIENT_ID}`
  );
  req.method = "post";
  req.body = getUrlEncodedParams({
    "pf.username": POLESTAR_EMAIL,
    "pf.pass": POLESTAR_PASSWORD,
  });
  req.headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookie,
  };
  req.onRedirect = (redReq) => {
    return null;
  };
  await req.load();
  const redirectUrl = req.response.headers.Location;
  const codeRegex = /code=([^&]+)/;
  let codeMatch = redirectUrl.match(codeRegex);
  const uidRegex = /uid=([^&]+)/;
  const uidMatch = redirectUrl.match(uidRegex);
  if (!codeMatch || codeMatch.length === 0) {
    console.warn("No code found");
    if (uidMatch && uidMatch.length > 0) {
      const uid = uidMatch[1];
      const reqConfirm = new Request(
        `https://polestarid.eu.polestar.com/as/${pathToken}/resume/as/authorization.ping?client_id=${CLIENT_ID}`
      );
      reqConfirm.method = "post";
      reqConfirm.body = getUrlEncodedParams({
        "pf.submit": true,
        subject: uid,
      });
      reqConfirm.headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      };
      reqConfirm.onRedirect = (redReq) => {
        return null;
      };
      await reqConfirm.load();
      const redirectUrl2 = reqConfirm.response.headers.Location;
      const codeRegex = /code=([^&]+)/;
      codeMatch = redirectUrl2.match(codeRegex);
      if (!codeMatch || codeMatch.length === 0) {
        throw new Error("No token found after confirmation");
      }
    } else {
      throw new Error("Not authenticated, please check login email & password");
    }
  }
  const tokenRequestCode = codeMatch[1];
  return tokenRequestCode;
}

/**
 * Liest die Auth-Seite und extrahiert den Pfad-Token aus dem Body.
 * Der Token steht nun im Text ab "url:" und ist das dritte "/"-Segment.
 */
async function getLoginFlowTokens() {
  // Baue die Parameter zusammen
  const params = getUrlEncodedParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: POLESTAR_REDIRECT_URI,
    scope: "openid profile email customer:attributes",
    state: "ea5aa2860f894a9287a4819dd5ada85c",
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: "S256",
  });

  // Erstelle den Request
  const url = `https://polestarid.eu.polestar.com/as/authorization.oauth2?${params}`;
  const req = new Request(url);

  // Setze optional Header (Cookie hier leer, kann aber wichtig sein, wenn man persistente Sessions braucht)
  req.method = "GET";
  req.headers = {
    Cookie: "",
  };

  // Lese den Body als String (kein Redirect mehr)
  const body = await req.loadString();

  // Extrahiere das Set-Cookie aus der Response
  // Da manche Libraries evtl. anders auf Headers zugreifen,
  // bitte sicherstellen, dass `req.response` und `req.response.headers` existieren:
  const cookies = req.response.headers["Set-Cookie"];
  // Hier holst du dir den ersten Teil vom Cookie (bis zum ersten Semikolon)
  // und fügst einen Strichpunkt am Ende hinzu, damit es als vollständiges Cookie nutzbar ist
  const cookie = cookies.split("; ")[0] + ";";

  // Nun im Body nach "url:" suchen und das dritte "/"-Segment als Token nehmen
  // (so wie in deinem Python-Code)
  let pathToken = null;
  if (body.includes("url:")) {
    // Splittet ab "url:", danach noch einmal mit "/" => 0: "", 1: "//irgendwas", 2: Token
    // Beispiel:  body.split("url:")[1] => "/https://domain.com/path1/path2" ...
    const partAfterUrl = body.split("url:")[1];         // alles nach "url:"
    const segments    = partAfterUrl.split("/");        // weiter aufteilen
    // segments[2] sollte dein Token sein (prüfe ggf. Segments-Länge ab)
    pathToken = segments[2];
  }

  // Gib Token und Cookie zurück
  return {
    pathToken,
    cookie,
  };
}

async function getApiToken(tokenRequestCode) {
  const req = new Request(`https://polestarid.eu.polestar.com/as/token.oauth2`);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  req.body = getUrlEncodedParams({
    grant_type: "authorization_code",
    code: tokenRequestCode,
    code_verifier: CODE_VERIFIER,
    client_id: CLIENT_ID,
    redirect_uri: POLESTAR_REDIRECT_URI,
  });

  req.onRedirect = (redReq) => {
    return null;
  };
  const apiCreds = await req.loadJSON();
  return {
    access_token: apiCreds.access_token,
    refresh_token: apiCreds.refresh_token,
    expires_in: apiCreds.expires_in,
  };
}

async function getTelematics(accessToken) {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }
  const searchParams = {
    query:
      "query CarTelematics($vin:String!) { carTelematics(vin: $vin) { battery { averageEnergyConsumptionKwhPer100Km,batteryChargeLevelPercentage,chargerConnectionStatus,chargingCurrentAmps,chargingPowerWatts,chargingStatus,estimatedChargingTimeMinutesToTargetDistance,estimatedChargingTimeToFullMinutes,estimatedDistanceToEmptyKm,estimatedDistanceToEmptyMiles,eventUpdatedTimestamp{iso,unix}}, odometer { averageSpeedKmPerHour,eventUpdatedTimestamp,{iso,unix},odometerMeters,tripMeterAutomaticKm,tripMeterManualKm}}}",
    variables: {
      vin: VIN,
    },
  };
  const req = new Request(POLESTAR_API_URL_V2);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + accessToken,
  };
  req.body = JSON.stringify(searchParams);
  const response = await req.loadJSON();
  if (!response?.data) {
    throw new Error("No telematics data fetched");
  }
  return response.data;
}

async function getVehicles(accessToken) {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }
  const searchParams = {
    query:
      "query getCars{getConsumerCarsV2{vin,internalVehicleIdentifier,modelYear,content{model{code,name},images,{studio,{url,angles}}},hasPerformancePackage,registrationNo,deliveryDate,currentPlannedDeliveryDate}}",
    variables: {},
  };
  const req = new Request(POLESTAR_API_URL_V2);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + accessToken,
  };
  req.body = JSON.stringify(searchParams);
  const response = await req.loadJSON();
  const vehicleData = response?.data?.getConsumerCarsV2;
  if (!vehicleData) {
    throw new Error("No vehicle data fetched");
  }
  const vehicle =
    vehicleData.find((vehicle) => vehicle.vin === VIN) ?? vehicleData[0];
  if (!vehicle) {
    throw new Error(`No vehicle found with VIN ${VIN}`);
  }
  VIN = vehicle.vin;
  return vehicle;
}

async function loadImage(url) {
  const req = new Request(url);
  return req.loadImage();
}

function getUrlEncodedParams(object) {
  return Object.keys(object)
    .map((key) => `${key}=${encodeURIComponent(object[key])}`)
    .join("&");
}

/*************
 * Formatters
 *************/
function getBatteryPercentColor(percent) {
  if (percent > MIN_SOC_GREEN) {
    return Color.green();
  } else if (percent > MIN_SOC_ORANGE) {
    return Color.orange();
  } else {
    return Color.red();
  }
}

function getBatteryIcon(
  batteryPercent,
  isConnected,
  isCharging,
  isChargingDone
) {
  let icon;
  let iconColor;
  if (isCharging || isChargingDone) {
    icon = isCharging
      ? SFSymbol.named("bolt.fill")
      : SFSymbol.named("bolt.badge.checkmark.fill");
    iconColor = Color.green();
  } else if (isConnected) {
    icon = SFSymbol.named("bolt.badge.xmark");
    iconColor = Color.red();
  } else {
    let percentRounded = 0;
    iconColor = Color.red();
    if (batteryPercent > 90) {
      percentRounded = 100;
    } else if (batteryPercent > 60) {
      percentRounded = 75;
    } else if (batteryPercent > 40) {
      percentRounded = 50;
    } else if (batteryPercent > 10) {
      percentRounded = 25;
    }
    iconColor = getBatteryPercentColor(batteryPercent);
    icon = SFSymbol.named(`battery.${percentRounded}`);
  }
  return { batteryIcon: icon, batteryIconColor: iconColor };
}
