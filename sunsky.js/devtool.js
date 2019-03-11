var dev_menu = new nw.Menu({ type: 'menubar' });

var submenu = new nw.Menu();
submenu.append(new nw.MenuItem(
    {   label: 'Reload', 
        key: 'r',
        modifiers: 'cmd',
        click: function()
        {
            location.reload();
        }
    }));

submenu.append(new nw.MenuItem(
    {   label: 'DevTools', 
        key: 't',
        modifiers: 'cmd',
        click: function()
        {
            nw.Window.get().showDevTools();
        }
    }));


submenu.append(new nw.MenuItem({ type : 'separator' }));

submenu.append(new nw.MenuItem(
    {   label: 'Quit', 
        key: 'q',
        modifiers: 'cmd',
        click: function()
        {
            nw.Window.get().close(true);
        }
    }));

// the menu item appended should have a submenu
dev_menu.append(new nw.MenuItem({
  label: 'Dev',
  submenu: submenu
}));

nw.Window.get().menu = dev_menu;