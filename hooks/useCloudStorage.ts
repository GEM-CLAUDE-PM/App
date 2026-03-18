import { useState, useEffect } from 'react';
import { Providers, ProviderState } from '@microsoft/mgt-element';
import { Msal2Provider } from '@microsoft/mgt-msal2-provider';
// @ts-ignore
import { gapi } from 'gapi-script';

export const useCloudStorage = (selectedProjectName: string) => {
  const [activeCloud, setActiveCloud] = useState<'none' | 'google' | 'onedrive'>('none');

  // 1. THIẾT LẬP HỆ THỐNG KHI KHỞI ĐỘNG
  useEffect(() => {
    // Khởi tạo Microsoft Provider nếu chưa có (Tránh lỗi TypeError)
    if (!Providers.globalProvider) {
      Providers.globalProvider = new Msal2Provider({
        clientId: import.meta.env.VITE_MS_CLIENT_ID || '',
        scopes: ['files.readwrite.all', 'user.read']
      });
    }

    // Khởi tạo Google API
    const initGapi = () => {
      gapi.client.init({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        scope: 'https://www.googleapis.com/auth/drive.file',
      }).then(() => {
        console.log("Nàng GEM: Google Drive đã thông tuyến!");
      });
    };
    gapi.load('client:auth2', initGapi);
  }, []);

  const createCloudFolder = async (targetCloud: 'google' | 'onedrive') => {
    try {
      if (targetCloud === 'google') {
        // Ép buộc đăng nhập bằng Popup để vượt lỗi 403 Silent Fail
        const authInstance = gapi.auth2.getAuthInstance();
        await authInstance.signIn({ prompt: 'select_account' });
        
        await gapi.client.drive.files.create({
          resource: { name: selectedProjectName, mimeType: 'application/vnd.google-apps.folder' },
          fields: 'id'
        });
        alert(`Nàng GEM: Đã tạo folder [${selectedProjectName}] trên G-Drive!`);
      } else {
        // Microsoft: Kiểm tra trạng thái đăng nhập trước khi gọi lệnh
        if (Providers.globalProvider.state !== ProviderState.SignedIn) {
          await Providers.globalProvider.login();
        }
        await Providers.globalProvider.graph.client.api('/me/drive/root/children').post({
          name: selectedProjectName, folder: {}, '@microsoft.graph.conflictBehavior': 'rename'
        });
        alert(`Nàng GEM: OneDrive đã khớp lệnh thành công!`);
      }
      setActiveCloud(targetCloud);
    } catch (error: any) {
      console.error('Lỗi chi tiết:', error);
      alert(`Dạ, lỗi rồi anh Tuấn ơi: ${error.error || error.message || 'Hệ thống đang bận'}`);
    }
  };

  return { activeCloud, createCloudFolder };
};