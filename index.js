import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3Client.js";
import { degrees, PDFDocument } from 'pdf-lib';
import fetch from 'node-fetch';
import fs from 'fs'
import * as dotenv from 'dotenv'

dotenv.config()

let watermark;
let bucketPutParams;

export const CreatePdf = async () => {
    const pdfDoc = await PDFDocument.create();
    console.log("PDF DOC Created");

    const pngUrl = process.env.PNG_URL
    const pngImageBytes = await fetch(pngUrl).then((res) => res.arrayBuffer()).catch(err=>console.log(err))
    console.log("Gets PNG Image");
    console.log(pngImageBytes);
    const pngImage = await pdfDoc.embedPng(pngImageBytes)
    const pngDims = pngImage.scale(1)
    
    const awsUrl = process.env.PDF_URL
    const existingPdfBytes = await fetch(awsUrl).then(res => res.arrayBuffer()).catch(err => console.log(err))
    console.log("Gets PDF DOC");
    console.log(existingPdfBytes);
    const awsPDF = await PDFDocument.load(existingPdfBytes);

    const pages = awsPDF.getPages();

    for (const [key, value] of Object.entries(pages)) 
    {
        const page = pdfDoc.addPage([pages[key].getWidth(), pages[key].getHeight()]);
        page.drawImage(pngImage, {
            x: 5,
            y: page.getHeight() / 2 + 300,
            width: pngDims.width,
            height: pngDims.height,
            rotate: degrees(-45)
        });

        const awsPage = await pdfDoc.embedPage(pages[key]);
        page.drawPage(awsPage, {
            width: page.getWidth(),
            height: page.getHeight(),
            x: 0,
            y: 0,
        });
    }
    console.log("finished creating doc");
    const pdfBytes = await pdfDoc.save()
    fs.writeFileSync('/tmp/watermark.pdf', pdfBytes)
    return watermark;
};

export const PutObject = async () => {
    try {
        console.log("Putting Watermarked PDF in s3 Bucket");
        const data = await s3Client.send(new PutObjectCommand(bucketPutParams));
        return data; // For unit tests.
        console.log(
        "Successfully uploaded object: " +
            bucketPutParams.Bucket +
            "/" +
            bucketPutParams.Key
        );
    } catch (err) {
        console.log("Error", err);
    }
};

export const handler = async() => {
    console.log("Beginning service");
     await CreatePdf()
    .then(res => {
        console.log("pdf promise");
        watermark = fs.readFileSync('/tmp/watermark.pdf')
        console.log("Read file");
        console.log(watermark);
        bucketPutParams = {
            Bucket: process.env.AWS_BUCKET,
            Key: "watermarked.pdf",
            Body: watermark,
            contentType : 'application/pdf'
        };
    });
    await PutObject();
}


