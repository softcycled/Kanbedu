import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { updateTagSchema, parseBody } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const raw = await request.json();
    const { data, error } = parseBody(updateTagSchema, raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const tag = await prisma.tag.update({
      where: { id: params.id },
      data: {
        name: data.name,
        color: data.color,
      },
    });

    return NextResponse.json(tag);
  } catch (error) {
    console.error("Failed to update tag:", error);
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await prisma.tag.delete({
      where: { id: params.id },
    });

    return NextResponse.json(deleted);
  } catch (error) {
    console.error("Failed to delete tag:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}
