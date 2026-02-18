import { NextRequest, NextResponse } from "next/server";
import { getUsers } from "@/lib/repcard";
import { getSales } from "@/lib/quickbase";
import { supabaseAdmin } from "@/lib/supabase";
import { dispositionCategory } from "@/lib/supabase-queries";
import { getRepSales, getMonday, getToday } from "@/lib/data";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = Number(params.id);
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("from") || getMonday();
  const toDate = searchParams.get("to") || getToday();

  try {
    const [users, sales] = await Promise.all([
      getUsers(),
      getSales(fromDate, toDate),
    ]);

    const user = users.find((u) => u.id === userId);
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Determine role
    const rcRole = (user.role || "").toLowerCase();
    const isCloser =
      rcRole.includes("closer") ||
      rcRole.includes("area director") ||
      rcRole.includes("regional manager");
    const role = isCloser ? "closer" : "setter";

    // Fetch appointments from Supabase
    const idField = role === "closer" ? "closer_id" : "setter_id";
    const { data: apptRows, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, contact_name, contact_address, appointment_time, disposition, has_power_bill, hours_to_appointment, is_quality, star_rating, setter_name, closer_name, office_team",
      )
      .eq(idField, userId)
      .gte("appointment_time", `${fromDate}T00:00:00Z`)
      .lte("appointment_time", `${toDate}T23:59:59Z`)
      .order("appointment_time", { ascending: false });

    if (apptError) throw apptError;

    const appointments = (apptRows || []).map((a) => ({
      ...a,
      disposition_category: dispositionCategory(a.disposition),
    }));

    // QB sales attributed to this rep
    const fullName = `${user.firstName} ${user.lastName}`;
    const { allSales: repSales } = getRepSales(sales, userId, fullName);

    return NextResponse.json({
      role,
      appointments,
      sales: repSales,
      period: { from: fromDate, to: toDate },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
