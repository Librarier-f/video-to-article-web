import io
import unittest
from unittest.mock import MagicMock, patch
from yt_dlp.extractor.bilibili import BiliBiliIE

from services.converter import extract_video_details


class TestConverterPerformance(unittest.TestCase):
    def test_only_one_subtitle_track_is_downloaded_after_metadata(self):
        ydl = MagicMock()
        ydl.extract_info.return_value = {
            "title": "test", "duration": 300, "upload_date": "20260101",
            "subtitles": {"zh-Hans": [{"url": "https://video.example/zh", "ext": "vtt"}],
                          "en": [{"url": "https://video.example/en", "ext": "vtt"}]},
            "url": "https://video.example/stream",
        }
        ydl.urlopen.return_value = io.BytesIO(b"WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nhello\n")
        with patch("services.converter.yt_dlp.YoutubeDL") as factory:
            factory.return_value.__enter__.return_value = ydl
            result = extract_video_details("https://youtube.com/watch?v=test")
        self.assertEqual(ydl.extract_info.call_args.kwargs["download"], False)
        self.assertEqual(ydl.urlopen.call_count, 1)
        self.assertEqual(result["cleaned_text"], "hello")

    def test_json3_track_is_parsed_as_transcript_not_json_source(self):
        ydl = MagicMock()
        ydl.extract_info.return_value = {
            "title": "test", "duration": 60,
            "automatic_captions": {"en": [{"url": "https://video.example/en", "ext": "json3"}]},
        }
        ydl.urlopen.return_value = io.BytesIO(b'{"events":[{"segs":[{"utf8":"hello "},{"utf8":"world"}]}]}')
        with patch("services.converter.yt_dlp.YoutubeDL") as factory:
            factory.return_value.__enter__.return_value = ydl
            result = extract_video_details("https://youtube.com/watch?v=test")
        self.assertEqual(result["cleaned_text"], "hello world")

    def test_bilibili_ai_subtitles_are_discovered_and_read_from_inline_data(self):
        ydl = MagicMock()

        def metadata(*args, **kwargs):
            extractor = BiliBiliIE(ydl)
            with patch.object(extractor, '_get_subtitles', return_value={
                'ai-zh': [{'ext': 'srt', 'data': '1\n00:00:01,000 --> 00:00:03,000\n这是AI字幕\n'}]
            }):
                # Exercise the real yt-dlp discovery gate rather than assuming
                # extract_info always supplies subtitles regardless of params.
                subtitles = extractor.extract_subtitles('BVtest', 123)
            return {'title': 'B站视频', 'duration': 300, 'subtitles': subtitles}

        ydl.extract_info.side_effect = metadata
        with patch('services.converter.yt_dlp.YoutubeDL') as factory:
            def construct(options):
                ydl.params = options
                context = MagicMock()
                context.__enter__.return_value = ydl
                return context
            factory.side_effect = construct
            result = extract_video_details('https://www.bilibili.com/video/BVtest')
        self.assertEqual(result['cleaned_text'], '这是AI字幕')
        ydl.urlopen.assert_not_called()
        self.assertFalse(ydl.extract_info.call_args.kwargs['download'])

    def test_inline_data_is_supported_without_a_url(self):
        ydl = MagicMock()
        ydl.extract_info.return_value = {
            'title': 'B站视频', 'duration': 60,
            'subtitles': {'ai-zh': [{'ext': 'srt', 'data': '1\n00:00:00,000 --> 00:00:01,000\n内嵌字幕\n'}]},
        }
        with patch('services.converter.yt_dlp.YoutubeDL') as factory:
            factory.return_value.__enter__.return_value = ydl
            result = extract_video_details('https://www.bilibili.com/video/BVtest')
        self.assertEqual(result['cleaned_text'], '内嵌字幕')
        ydl.urlopen.assert_not_called()

    def test_track_error_reports_read_failure_instead_of_missing_subtitles(self):
        ydl = MagicMock()
        ydl.extract_info.return_value = {
            'title': 'test', 'subtitles': {'ai-zh': [{'ext': 'srt', 'url': 'https://example.com/sub'}]},
        }
        ydl.urlopen.side_effect = TimeoutError('private signed URL must not appear')
        logs = []
        with patch('services.converter.yt_dlp.YoutubeDL') as factory:
            factory.return_value.__enter__.return_value = ydl
            with self.assertRaisesRegex(Exception, '已发现.*读取失败') as error:
                extract_video_details('https://www.bilibili.com/video/BVtest', log_func=logs.append)
        self.assertIn('TimeoutError', str(error.exception))
        self.assertNotIn('private signed URL', str(error.exception))
