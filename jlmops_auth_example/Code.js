const USER_ROLES_SHEET_ID = '1ESV9fJHKykPzy3kS88S9FWF46YodTuJ35O8MvfVModM';
const USER_ROLES_SHEET_NAME = 'UserRoles';

function doGet(e) {
  const userEmail = Session.getActiveUser().getEmail();
  if (!userEmail) {
    return HtmlService.createHtmlOutput('<h1>Please log in with your Google account.</h1>');
  }

  const initialRole = getUserRole(userEmail);

  if (initialRole !== 'administrator' && initialRole !== 'manager') {
    const template = HtmlService.createTemplateFromFile('AccessDenied');
    template.email = userEmail;
    return template.evaluate();
  }

  const template = HtmlService.createTemplateFromFile('AppView');
  template.initialRole = initialRole;
  template.availableRoles = getAvailableRoles(initialRole);
  
  return template.evaluate();
}

function getAvailableRoles(userRole) {
  if (userRole === 'administrator') {
    return ['administrator', 'manager'];
  }
  return ['manager'];
}

function getUserRole(email) {
  try {
    const spreadsheet = SpreadsheetApp.openById(USER_ROLES_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(USER_ROLES_SHEET_NAME);
    if (!sheet) {
      return null;
    }
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].trim().toLowerCase() === email.trim().toLowerCase()) {
        return data[i][1].trim().toLowerCase();
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDashboardForRole(role) {
  switch (role) {
    case 'administrator':
      return include('AdminPage');
    case 'manager':
      return include('ManagerPage');
    default:
      return '<div>Invalid role selected.</div>';
  }
}