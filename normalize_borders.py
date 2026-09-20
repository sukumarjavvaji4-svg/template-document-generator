import sys
import os
import pymupdf

def normalize_pdf_borders(pdf_path):
    try:
        doc = pymupdf.open(pdf_path)
        modified = False
        for page in doc:
            text = page.get_text()
            if "VNR VJIET" in text or "Name of the Laboratory" in text:
                try:
                    stream = page.read_contents().decode("latin1")
                    original_stream = stream
                    
                    if "839.389" in stream and "835.639" in stream:
                        # Move top double lines below header
                        stream = stream.replace("32.4 839.389 m\n562.95 839.389 l S", "32.4 746.089 m\n562.95 746.089 l S")
                        stream = stream.replace("35.4 835.639 m\n558.45 835.639 l S", "35.4 742.339 m\n558.45 742.339 l S")
                        
                        # Trim top of left and right vertical borders
                        stream = stream.replace("561.45 840.889 m", "561.45 746.089 m")
                        stream = stream.replace("557.7 837.889 m", "557.7 742.339 m")
                        stream = stream.replace("33.9 840.889 l S", "33.9 746.089 l S")
                        stream = stream.replace("37.65 836.389 l S", "37.65 742.339 l S")
                        
                        if stream != original_stream:
                            page.clean_contents()
                            doc.update_stream(page.get_contents()[0], stream.encode("latin1"))
                            modified = True
                except Exception as e:
                    print("Page border normalization error:", e, file=sys.stderr)
                    
        if modified:
            temp_out = pdf_path + ".norm.tmp"
            doc.save(temp_out)
            doc.close()
            os.replace(temp_out, pdf_path)
            print("Successfully normalized PDF borders below header")
        else:
            doc.close()
    except Exception as e:
        print("PDF normalization error:", e, file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        normalize_pdf_borders(sys.argv[1])

