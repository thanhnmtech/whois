import { filterRepeat } from "@/lib/utils";

const MAX_WHOIS_FOLLOW = process.env.MAX_WHOIS_FOLLOW
  ? parseInt(process.env.MAX_WHOIS_FOLLOW)
  : 5;

export type WhoisResult = {
  status: boolean;
  time: number;
  result?: WhoisAnalyzeResult;
  error?: string;
};

export function lookupWhois(
  domain: string,
  disableFollow: boolean = true,
): Promise<WhoisResult> {
  const whois = require("whois-raw");
  const startTime = Date.now();

  // Where possible don't follow the detailed results to improve efficiency
  // And follow 0 can solve the problem of `whois.dnspod.com connection refused`
  const options = {
    follow: disableFollow ? 0 : MAX_WHOIS_FOLLOW,
  };

  return new Promise((resolve) => {
    try {
      whois.lookup(domain, options, (err: Error, data: string) => {
        const endTime = Date.now();
        const usedTime = (endTime - startTime) / 1000;

        if (err) {
          resolve({
            status: false,
            time: usedTime,
            error: err.message,
          });
        } else {
          if (
            data.toLowerCase().includes("no match for domain") ||
            data.toLowerCase().includes("this query returned 0 objects")
          ) {
            resolve({
              status: false,
              time: usedTime,
              error: `No match for domain ${domain} (e.g. domain is not registered)`,
            });
          }

          resolve({
            status: true,
            time: usedTime,
            result: analyzeWhois(data),
          });
        }
      });
    } catch (e) {
      const message = (e as Error).message;
      resolve({
        status: false,
        time: 0,
        error: message,
      });
    }
  });
}

export type WhoisAnalyzeResult = {
  domain: string;
  registrar: string;
  registrarURL: string;
  ianaId: string;
  whoisServer: string;
  updatedDate: string;
  creationDate: string;
  expirationDate: string;
  status: DomainStatusProps[];
  registrantOrganization: string;
  registrantProvince: string;
  registrantCountry: string;
  registrantPhone: string;
  registrantEmail: string;
  rawWhoisContent: string;
};

type DomainStatusProps = {
  status: string;
  url: string;
};

const initialWhoisAnalyzeResult: WhoisAnalyzeResult = {
  domain: "",
  registrar: "Unknown",
  registrarURL: "Unknown",
  ianaId: "N/A",
  whoisServer: "Unknown",
  updatedDate: "Unknown",
  creationDate: "Unknown",
  expirationDate: "Unknown",
  status: [],
  registrantOrganization: "Unknown",
  registrantProvince: "Unknown",
  registrantCountry: "Unknown",
  registrantPhone: "Unknown",
  registrantEmail: "Unknown",
  rawWhoisContent: "",
};

function analyzeDomainStatus(status: string): DomainStatusProps {
  const segments = status.split(" ");
  let url = segments.slice(1).join(" ");

  url.startsWith("(") && url.endsWith(")") && (url = url.slice(1, -1));
  return {
    status: segments[0],
    url,
  };
}

function analyzeTime(time: string): string {
  if (!time || time.length === 0) return time;

  try {
    const date = new Date(time);
    return date.toISOString();
  } catch (e) {
    return time;
  }
}

export function analyzeWhois(data: string): WhoisAnalyzeResult {
  const lines = data
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result: WhoisAnalyzeResult = { ...initialWhoisAnalyzeResult };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const segments = line.split(":");
    if (segments.length < 2) continue;

    const key = segments[0].trim().toLowerCase();
    const value = segments.slice(1).join(":").trim();

    switch (key) {
      case "domain name":
        result.domain = value;
        break;
      case "registrar":
        result.registrar = value;
        break;
      case "registrar url":
        result.registrarURL = value;
        break;
      case "iana id":
        result.ianaId = value;
        break;
      case "registrar iana id":
        result.ianaId = value;
        break;
      case "whois server":
        result.whoisServer = value;
        break;
      case "registrar whois server":
        result.whoisServer = value;
        break;
      case "updated date":
        result.updatedDate = analyzeTime(value);
        break;
      case "creation date":
        result.creationDate = analyzeTime(value);
        break;
      case "expiration date":
        result.expirationDate = analyzeTime(value);
        break;
      case "registrar registration expiration date":
        result.expirationDate = analyzeTime(value);
        break;
      case "registry expiry date":
        result.expirationDate = analyzeTime(value);
        break;
      case "status":
        result.status.push(analyzeDomainStatus(value));
        break;
      case "domain status":
        result.status.push(analyzeDomainStatus(value));
        break;
      case "registrant name":
        result.registrantOrganization = value;
        break;
      case "registrant organization":
        result.registrantOrganization = value;
        break;
      case "registrant state/province":
        result.registrantProvince = value;
        break;
      case "registrant country":
        result.registrantCountry = value;
        break;
      case "registrant phone":
        result.registrantPhone = value.replace("tel:", "").replace(".", " ");
        break;
      case "registrar abuse contact phone":
        result.registrantPhone = value.replace("tel:", "").replace(".", " ");
        break;
      case "registrant email":
        result.registrantEmail = value.replace(
          "Select Request Email Form at ",
          "",
        );
        break;
    }
  }

  result.rawWhoisContent = data;

  result.status = filterRepeat<DomainStatusProps>(
    result.status.filter((status) => status.status.length > 0),
  );

  return result;
}
