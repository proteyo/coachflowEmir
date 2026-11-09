"""Mocked cloud cleanup: never reads or deletes real uploaded files."""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import test_regressions
from app.services.storage_service import delete_user_uploads


class StorageErasureTests(unittest.TestCase):
    def service(self):
        client = Mock()
        client.list_objects_v2.return_value = {"Contents": []}
        client.delete_objects.return_value = {}
        return SimpleNamespace(settings=SimpleNamespace(STORAGE_BUCKET_NAME="test-only"), _s3_client=client, _gcs_bucket=None)

    def test_exact_owner_only_and_thumbnail_folder_distinction(self):
        service = self.service()
        def listing(**kw):
            folder = kw["Prefix"].split('/')[0]
            names = ['u_client_'+'a'*16+'.jpg', 'u_client_other_'+'a'*16+'.jpg', 'u_client_thumb_'+'a'*16+'.jpg', 'u_client_../../unsafe.jpg']
            return {"Contents": [{"Key": folder+'/'+name} for name in names]}
        service._s3_client.list_objects_v2.side_effect = listing
        with patch('app.services.storage_service.get_storage_service', return_value=service):
            self.assertTrue(delete_user_uploads('u_client'))
        keys = [obj['Key'] for call in service._s3_client.delete_objects.call_args_list for obj in call.kwargs['Delete']['Objects']]
        self.assertEqual(len(keys), 5)
        self.assertTrue(all('other' not in key and '..' not in key for key in keys))
        self.assertEqual([key for key in keys if '_thumb_' in key], ['video-thumbnails/u_client_thumb_'+'a'*16+'.jpg'])

    def test_partial_cloud_failure_is_not_reported_as_complete(self):
        service = self.service()
        service._s3_client.list_objects_v2.return_value = {'Contents':[{'Key':'avatars/u_client_'+'a'*16+'.jpg'}]}
        service._s3_client.delete_objects.return_value = {'Errors':[{'Code':'AccessDenied'}]}
        with patch('app.services.storage_service.get_storage_service', return_value=service), self.assertRaises(RuntimeError):
            delete_user_uploads('u_client')

    def test_invalid_owner_never_reaches_storage(self):
        with patch('app.services.storage_service.get_storage_service') as factory:
            for owner in ('../other', '', 'user/path'):
                with self.assertRaises(ValueError):
                    delete_user_uploads(owner)
            factory.assert_not_called()
