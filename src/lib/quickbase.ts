import { QB_API_TOKEN, QB_REALM, QB_PROJECTS_TABLE } from "./config";

async function qbQuery(
  tableId: string,
  select: number[],
  where: string,
  top = 500,
) {
  const res = await fetch("https://api.quickbase.com/v1/records/query", {
    method: "POST",
    headers: {
      "QB-Realm-Hostname": QB_REALM,
      Authorization: `QB-USER-TOKEN ${QB_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: tableId,
      select,
      where,
      options: { skip: 0, top },
    }),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`QB API error: ${res.status}`);
  return res.json();
}

export interface QBSale {
  saleDate: string;
  customerName: string;
  closerName: string;
  setterName: string;
  salesOffice: string;
  systemSizeKw: number;
  netPpw: number;
  state: string;
  status: string;
  closerRepCardId: string;
  setterRepCardId: string;
}

// FIDs: 6=Project Name (customer), 522=Sale Date, 517=Closer Name, 337=Setter Name,
//       339=Sales Office, 13=System Size kW, 543=Net PPW, 189=State, 255=Status,
//       2277=Related Closer repcard_id, 2279=Related Setter repcard_id
const SALE_FIELDS = [6, 522, 517, 337, 339, 13, 543, 189, 255, 2277, 2279];

export async function getSales(
  fromDate: string,
  toDate: string,
): Promise<QBSale[]> {
  const data = await qbQuery(
    QB_PROJECTS_TABLE,
    SALE_FIELDS,
    `{522.AF.${fromDate}}AND{522.BF.${toDate}}`,
  );

  return (data.data || []).map((r: any) => ({
    saleDate: r["522"]?.value || "",
    customerName: r["6"]?.value || "",
    closerName: r["517"]?.value || "",
    setterName: r["337"]?.value || "",
    salesOffice: r["339"]?.value || "",
    systemSizeKw: parseFloat(r["13"]?.value || 0),
    netPpw: parseFloat(r["543"]?.value || 0),
    state: r["189"]?.value || "",
    status: r["255"]?.value || "",
    closerRepCardId: r["2277"]?.value || "",
    setterRepCardId: r["2279"]?.value || "",
  }));
}

export interface QBInstall {
  installDate: string;
  closerName: string;
  salesOffice: string;
  systemSizeKw: number;
}

// FIDs: 534=Install Complete, 517=Closer Name, 339=Sales Office, 13=System Size
const INSTALL_FIELDS = [534, 517, 339, 13];

export async function getInstalls(
  fromDate: string,
  toDate: string,
): Promise<QBInstall[]> {
  const data = await qbQuery(
    QB_PROJECTS_TABLE,
    INSTALL_FIELDS,
    `{534.AF.${fromDate}}AND{534.BF.${toDate}}`,
  );

  return (data.data || []).map((r: any) => ({
    installDate: r["534"]?.value || "",
    closerName: r["517"]?.value || "",
    salesOffice: r["339"]?.value || "",
    systemSizeKw: parseFloat(r["13"]?.value || 0),
  }));
}
