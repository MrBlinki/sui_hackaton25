import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Track title is required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Only audio files are allowed" },
        { status: 400 }
      );
    }

    // Create a safe filename based on the title
    const safeTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    // Get file extension from original file
    const fileExtension = path.extname(file.name) || ".mp3";
    const filename = `${safeTitle}${fileExtension}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Define the upload path
    const uploadPath = path.join(process.cwd(), "public", "audio", filename);

    // Write the file
    await writeFile(uploadPath, buffer);

    return NextResponse.json({
      message: "File uploaded successfully",
      filename: filename,
      title: title,
      path: `/audio/${filename}`
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}