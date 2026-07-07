import { useRef } from "react";
import { Camera, ImagePlus, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { warnIfMovFiles } from "@/components/MediaLightbox";
import {
  IMAGE_FILE_ACCEPT,
  IOS_SAFE_FILE_INPUT_CLASS,
  VIDEO_FILE_ACCEPT,
} from "@/lib/utils/media-limits";

interface MediaAttachButtonsProps {
  onFiles: (files: FileList, kind: "image" | "video") => void;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function MediaAttachButtons({
  onFiles,
  disabled = false,
  size = "default",
}: MediaAttachButtonsProps) {
  const imgCaptureRef = useRef<HTMLInputElement>(null);
  const imgPickRef = useRef<HTMLInputElement>(null);
  const vidCaptureRef = useRef<HTMLInputElement>(null);
  const vidPickRef = useRef<HTMLInputElement>(null);

  const btnSize = size === "sm" ? "sm" : "default";
  const btnClass = size === "sm" ? "gap-1 text-xs" : "gap-1";

  const handleImage = (files: FileList | null, input: HTMLInputElement | null) => {
    if (!files?.length) return;
    onFiles(files, "image");
    if (input) input.value = "";
  };

  const handleVideo = (files: FileList | null, input: HTMLInputElement | null) => {
    if (!files?.length) return;
    warnIfMovFiles(files);
    onFiles(files, "video");
    if (input) input.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={imgCaptureRef}
        type="file"
        accept={IMAGE_FILE_ACCEPT}
        multiple
        capture="environment"
        className={IOS_SAFE_FILE_INPUT_CLASS}
        onChange={(e) => handleImage(e.target.files, imgCaptureRef.current)}
      />
      <input
        ref={imgPickRef}
        type="file"
        accept={IMAGE_FILE_ACCEPT}
        multiple
        className={IOS_SAFE_FILE_INPUT_CLASS}
        onChange={(e) => handleImage(e.target.files, imgPickRef.current)}
      />
      <input
        ref={vidCaptureRef}
        type="file"
        accept={VIDEO_FILE_ACCEPT}
        multiple
        capture="environment"
        className={IOS_SAFE_FILE_INPUT_CLASS}
        onChange={(e) => handleVideo(e.target.files, vidCaptureRef.current)}
      />
      <input
        ref={vidPickRef}
        type="file"
        accept={VIDEO_FILE_ACCEPT}
        multiple
        className={IOS_SAFE_FILE_INPUT_CLASS}
        onChange={(e) => handleVideo(e.target.files, vidPickRef.current)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size={btnSize}
          variant="outline"
          className={btnClass}
          disabled={disabled}
          onClick={() => imgCaptureRef.current?.click()}
        >
          <Camera className="h-4 w-4" /> ถ่ายรูป
        </Button>
        <Button
          type="button"
          size={btnSize}
          variant="outline"
          className={btnClass}
          disabled={disabled}
          onClick={() => imgPickRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" /> เลือกรูป
        </Button>
        <Button
          type="button"
          size={btnSize}
          variant="outline"
          className={btnClass}
          disabled={disabled}
          onClick={() => vidCaptureRef.current?.click()}
        >
          <VideoIcon className="h-4 w-4" /> ถ่ายวิดีโอ
        </Button>
        <Button
          type="button"
          size={btnSize}
          variant="outline"
          className={btnClass}
          disabled={disabled}
          onClick={() => vidPickRef.current?.click()}
        >
          <VideoIcon className="h-4 w-4" /> เลือกวิดีโอ
        </Button>
      </div>
    </div>
  );
}
