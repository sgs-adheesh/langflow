import { useContext } from "react";
import { CustomProfileIcon } from "@/customization/components/custom-profile-icon";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";
import { 
  HeaderMenu, 
  HeaderMenuToggle, 
  HeaderMenuItems, 
  HeaderMenuItemButton 
} from "@/components/core/appHeaderComponent/components/HeaderMenu";
import { useLogout } from "@/controllers/API/queries/auth";
import { AuthContext } from "@/contexts/authContext";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";

export const AccountMenu = () => {
  const { mutate: mutationLogout } = useLogout();
  const { clearAuthSession } = useContext(AuthContext);
  const navigate = useCustomNavigate();

  const handleLogout = () => {
    mutationLogout(undefined, {
      onSuccess: () => {
        clearAuthSession();
        navigate("/login");
      },
    });
  };

  return (
    <HeaderMenu>
      <ShadTooltip
        content="Profile"
        side="bottom"
        styleClasses="z-10"
      >
        <HeaderMenuToggle>
          <div className="h-6 w-6 rounded-lg">
            <CustomProfileIcon />
          </div>
        </HeaderMenuToggle>
      </ShadTooltip>
      <HeaderMenuItems position="right">
        <HeaderMenuItemButton 
          icon="LogOut" 
          onClick={handleLogout}
        >
          Logout
        </HeaderMenuItemButton>
      </HeaderMenuItems>
    </HeaderMenu>
  );
};